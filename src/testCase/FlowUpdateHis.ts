import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "./PreTest";
import Action from "../action/Action";
import QueryAction from "../action/QueryAction";
import PreCreateNoteAndLink from "./PreCreateNoteAndLink";
import ListNoteGroup from "../action/note/ListNoteGroup";
import BatchProcessNote from "../action/note/BatchProcessNote";
import UpdateCntAndPrice from "../action/note/UpdateCntAndPrice";
import ChangeWarehouse from "../action/user/ChangeWarehouse";
import ChangeWarehouse2Supplier from "../action/user/ChangeWarehouse2Supplier";
import { WarehouseType } from "../inf/IOpt";

function listHis(opt: {
  name: string
  remark: string
  tableId: string
  tableName: string
  checkArray: any[]
  check?(result)
}) {
  return new QueryAction({
    name: opt.name,
    url: '/app/updateHis/listUpdateHis',
    query: {
      tableId: opt.tableId,
      tableName: opt.tableName
    },
    checkers: {
      checkArray: opt.checkArray
    }
  }, {
    check: opt.check
  }).setRemark(opt.remark)
}

function listNoteHis(opt: {
  name: string
  remark: string
  noteId?: string
  checkArray: any[]
  check?(result)
  warehouseType?: WarehouseType
}) {
  return new QueryAction({
    name: opt.name,
    url: '/app/updateHis/listNoteUpdateHis',
    query: {
      noteId: opt.noteId ?? '${noteId}'
    },
    checkers: {
      checkArray: opt.checkArray
    }
  }, {
    warehouseType: opt.warehouseType,
    check: opt.check
  }).setRemark(opt.remark)
}

function checkSmSnap(data: any, price: number, buyUnitFee: number) {
  CheckUtil.expectNotNull(data?.materialId)
  CheckUtil.expectNotNull(data?.supplierId)
  CheckUtil.expectEqual(data?.price, price)
  CheckUtil.expectEqual(data?.buyUnitFee, buyUnitFee)
}

function findHis(result: any, pred: (row: any) => boolean): any {
  return (result.result.content ?? []).find(pred)
}

function checkNoteRow(row: any, action: string) {
  CheckUtil.expectNotNull(row)
  CheckUtil.expectEqual(row.tableName, 'note')
  CheckUtil.expectEqual(row.action, action)
  CheckUtil.expectEqual(row.parentTable, 'note')
  CheckUtil.expectEqual(row.parentId, row.tableId)
  CheckUtil.expectNotNull(row.data?.detail)
  CheckUtil.expectEqual(row.data?.oldData == null, true)
  CheckUtil.expectEqual(row.data?.newData == null, true)
}

function checkNoteItemUpdateHis(row: any, opt: {
  action: string
  oldPrice: number
  newPrice: number
  oldInstockCnt: number
  newInstockCnt: number
}) {
  CheckUtil.expectNotNull(row)
  CheckUtil.expectEqual(row.tableName, 'noteItem')
  CheckUtil.expectEqual(row.action, opt.action)
  CheckUtil.expectEqual(row.parentTable, 'note')
  CheckUtil.expectNotNull(row.parentId)
  let oldData = row.data?.oldData
  let newData = row.data?.newData
  CheckUtil.expectNotNull(oldData?.materialId)
  CheckUtil.expectNotNull(newData?.materialId)
  CheckUtil.expectEqual(oldData?.instockCnt, opt.oldInstockCnt)
  CheckUtil.expectEqual(newData?.instockCnt, opt.newInstockCnt)
  CheckUtil.expectEqual(oldData?.price, opt.oldPrice)
  CheckUtil.expectEqual(newData?.price, opt.newPrice)
  CheckUtil.expectNotNull(oldData?.buyUnitFee)
  CheckUtil.expectNotNull(oldData?.stockBuyUnitFee)
  CheckUtil.expectNotNull(newData?.buyUnitFee)
  CheckUtil.expectNotNull(newData?.stockBuyUnitFee)
  let detail = String(row.data?.detail ?? '')
  CheckUtil.expectEqual(detail.indexOf('原来') >= 0, true)
  CheckUtil.expectEqual(detail.indexOf('新') >= 0, true)
  let priceChanged = opt.oldPrice !== opt.newPrice
  let cntChanged = opt.oldInstockCnt !== opt.newInstockCnt
  CheckUtil.expectEqual(detail.indexOf('价格') >= 0, priceChanged)
  CheckUtil.expectEqual(detail.indexOf('数量') >= 0, cntChanged)
}

/**
 * 修改历史（见同目录 FlowUpdateHis.md）。
 * 覆盖供应商/仓库改名、供应关系增删改、订单发单/入库/改价/结算，以及关联后接单/发货。
 */
export default class extends TestCase {
  constructor() {
    super({
      remark: '供应商/仓库/供应关系/订单状态与改价的修改历史'
    })
  }

  getName(): string {
    return '修改记录'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest().setRemark('初始化餐厅、供应商1/2、物料'),

      new NoteStatusHis(),
      new SupplierMaterialHis(),
      new SupplierHis(),
      new WarehouseHis(),

      new PreCreateNoteAndLink({
        supplierName: '供应商A'
      }).setRemark('首单分享接单，建立餐厅与供应商关联'),

      new QueryAction({
        name: '查询关联历史',
        url: '/app/updateHis/listUpdateHis',
        query: {
          ids: [
            ['${supplierMap.供应商1}', 'supplier'],
            ['${supplierMap.供应商1}', 'Supplier_Link'],
            ['${supplierWarehouse.warehouseId}', 'warehouse'],
            ['${supplierWarehouse.warehouseId}', 'Supplier_Link']
          ]
        },
        checkers: {
          checkArray: [
            {
              tableName: 'Supplier_Link'
            }
          ]
        }
      }).setRemark('校验 Supplier_Link 关联历史存在'),

      new NoteAcceptSendHis()
    ]
  }
}

class SupplierHis extends TestCase {
  constructor() {
    super({ remark: '修改供应商名称，校验统一 json 的 newData 与 warehouseGroupId' })
  }

  getName(): string {
    return '供应商修改历史'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '修改供应商',
        remark: '供应商1 改名为 供应商A',
        url: '/app/supplier/updateSupplier',
        param: {
          supplierId: '${supplierMap.供应商1}',
          name: '供应商A'
        }
      }),
      new QueryAction({
        name: '查询供应商修改记录',
        url: '/app/updateHis/listUpdateHis',
        query: {
          tableId: '${supplierMap.供应商1}',
          tableName: 'supplier'
        },
        checkers: {
          checkArray: [
            {
              action: 'update',
              tableName: 'supplier',
              data: {
                remark: '名称修改',
                newData: {
                  name: '供应商A'
                }
              }
            }
          ]
        }
      }, {
        check(result) {
          let rows: any[] = result.result.content
          let row = rows.find(item => item.action == 'update')
          CheckUtil.expectNotNull(row?.warehouseGroupId)
        }
      }).setRemark('校验供应商历史：action=update，newData.name=供应商A，有 warehouseGroupId')
    ]
  }
}

class WarehouseHis extends TestCase {
  constructor() {
    super({ remark: '连续改两次仓库名称，校验两次 newData' })
  }

  getName(): string {
    return '仓库修改历史'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        headers: {
          token: '${token}'
        },
        name: '修改仓库',
        remark: '餐厅改名为 新餐厅2',
        url: '/app/warehouse/updateWarehouse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          name: '新餐厅2'
        }
      }),
      new Action({
        headers: {
          token: '${token}'
        },
        name: '修改仓库',
        remark: '餐厅改名为 新餐厅3',
        url: '/app/warehouse/updateWarehouse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          name: '新餐厅3'
        }
      }),
      listHis({
        name: '查询仓库修改记录',
        remark: '校验两次改名都写入 newData.name',
        tableId: '${warehouse.warehouseId}',
        tableName: 'warehouse',
        checkArray: [
          {
            action: 'update',
            data: {
              newData: {
                name: '新餐厅2'
              }
            }
          },
          {
            action: 'update',
            data: {
              newData: {
                name: '新餐厅3'
              }
            }
          }
        ]
      })
    ]
  }
}

class SupplierMaterialHis extends TestCase {
  constructor() {
    super({ remark: '猪肉新增供应商2报价，改价后再删除，逐步校验 add/update/del 历史' })
  }

  getName(): string {
    return '供应关系修改历史'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '新增供应关系',
        remark: '猪肉绑定供应商2，单价15',
        url: '/app/supplierMaterial/addSupplierMaterial',
        param: {
          materialId: '${materialMap.猪肉.materialId}',
          supplierId: '${supplierMap.供应商2}',
          price: 15,
          buyUnitFee: 1,
          stockUnitsId: 0,
          warehouseId: '${warehouse.warehouseId}'
        }
      }),
      new Action({
        name: '查询供应关系',
        remark: '取出刚新增的 supplierMaterialId',
        url: '/app/supplierMaterial/getSupplierMaterial',
        param: {
          materialId: '${materialMap.猪肉.materialId}',
          supplierId: '${supplierMap.供应商2}',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        buildVariable(result) {
          let list: any = result.result
          if (list != null && list.content != null) {
            list = list.content
          }
          let row = (list ?? [])[0]
          if (row == null || row.supplierMaterialId == null) {
            throw new Error('未找到新增的供应关系')
          }
          return {
            smId: row.supplierMaterialId
          }
        }
      }),
      listHis({
        name: '查询供应关系新增历史',
        remark: '校验 action=add，newData 含 materialId/supplierId/price/buyUnitFee',
        tableId: '${smId}',
        tableName: 'supplierMaterial',
        checkArray: [
          {
            action: 'add',
            tableName: 'supplierMaterial',
            parentTable: 'material',
            data: {
              remark: '新增:猪肉',
              newData: {
                price: 15,
                buyUnitFee: 1
              }
            }
          }
        ],
        check(result) {
          let row = findHis(result, item => item.action == 'add')
          checkSmSnap(row?.data?.newData, 15, 1)
          CheckUtil.expectEqual(row.parentId, row.data.newData.materialId)
          CheckUtil.expectEqual(row.data?.oldData == null, true)
        }
      }),
      new Action({
        name: '修改供应单价',
        remark: '猪肉-供应商2 单价 15→25',
        url: '/app/supplierMaterial/updatePrice',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          items: [
            {
              supplierMaterialId: '${smId}',
              price: 25,
              buyUnitFee: 1
            }
          ]
        }
      }),
      listHis({
        name: '查询供应关系改价历史',
        remark: '校验 action=update，只记变化字段到 newData，price 与 buyUnitFee 成对',
        tableId: '${smId}',
        tableName: 'supplierMaterial',
        checkArray: [
          {
            action: 'update',
            parentTable: 'material',
            data: {
              remark: '修改:猪肉',
              newData: {
                price: 25,
                buyUnitFee: 1
              }
            }
          }
        ],
        check(result) {
          let row = findHis(result, item => item.action == 'update')
          checkSmSnap(row?.data?.newData, 25, 1)
          CheckUtil.expectEqual(row.parentId, row.data.newData.materialId)
          CheckUtil.expectEqual(row.data?.oldData == null, true)
        }
      }),
      new Action({
        name: '删除供应关系',
        remark: '删除猪肉-供应商2 报价',
        url: '/app/supplierMaterial/delSupplierMaterial',
        param: {
          supplierMaterialId: '${smId}'
        }
      }),
      listHis({
        name: '查询供应关系删除历史',
        remark: '校验 action=del，只记 oldData（含 materialId/supplierId/price/buyUnitFee）',
        tableId: '${smId}',
        tableName: 'supplierMaterial',
        checkArray: [
          {
            action: 'del',
            parentTable: 'material',
            data: {
              remark: '删除:猪肉',
              oldData: {
                price: 25,
                buyUnitFee: 1
              }
            }
          }
        ],
        check(result) {
          let row = findHis(result, item => item.action == 'del')
          checkSmSnap(row?.data?.oldData, 25, 1)
          CheckUtil.expectEqual(row.parentId, row.data.oldData.materialId)
        }
      })
    ]
  }
}

class NoteStatusHis extends TestCase {
  constructor() {
    super({ remark: '下单发单→入库→改价→改价改入库量→结算，用 listNoteUpdateHis 校验 note/noteItem 历史' })
  }

  getName(): string {
    return '订单状态修改历史'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '下单猪肉',
        remark: '餐厅向供应商1下单猪肉 cnt=10, price=2',
        url: '/app/note/createNote',
        method: 'post',
        param: {
          items: [
            {
              materialId: '${materialMap.猪肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 10,
              buyUnitFee: 1,
              stockUnitsId: 0,
              price: 2,
              stockBuyUnitFee: 1
            }
          ],
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result
          return {
            noteIds: ArrayUtil.toArray(content, 'noteId'),
            noteId: content[0].noteId,
            note: content[0]
          }
        }
      }),
      new Action({
        name: '发送订单',
        remark: 'sendNote，整单历史 action=normal，detail=title',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }),
      listNoteHis({
        name: '查询发单历史',
        remark: 'listNoteUpdateHis：note 的 detail 为订单号，无 oldData/newData',
        checkArray: [
          {
            action: 'normal',
            tableName: 'note',
            parentTable: 'note',
            data: {
              remark: '发单'
            }
          }
        ],
        check(result) {
          checkNoteRow(findHis(result, item => item.tableName == 'note' && item.action == 'normal'), 'normal')
        }
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal'
      }).setRemark('取待入库分组，供批量入库'),
      new BatchProcessNote({
        action: 'instock'
      }).setRemark('批量入库，只记整单 note，不记 noteItem'),
      listNoteHis({
        name: '查询入库历史',
        remark: 'send/instock/statement 只记 note，detail=title',
        checkArray: [
          {
            action: 'instocked',
            tableName: 'note',
            parentTable: 'note',
            data: {
              remark: '入库'
            }
          }
        ],
        check(result) {
          CheckUtil.expectNotFind(result.result.content ?? [], { tableName: 'noteItem', action: 'instocked' })
          checkNoteRow(findHis(result, item => item.tableName == 'note' && item.action == 'instocked'), 'instocked')
        }
      }),
      new QueryAction({
        name: '记下入库明细',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${noteId}'
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content
          let pork = content.find(row => row.name == '猪肉')
          return {
            noteItems: content,
            porkNoteItemId: pork.noteItemId
          }
        }
      }).setRemark('记下猪肉 noteItemId，供改价'),
      new UpdateCntAndPrice({
        name: '修改入库价格',
        changes: [
          { name: '猪肉', price: 5 }
        ]
      }).setRemark('updatePrice：猪肉单价 2→5'),
      listNoteHis({
        name: '查询改价历史',
        remark: 'updatePrice 记 noteItem 的 oldData/newData，不写整单 note',
        checkArray: [
          {
            action: 'updateCntAndPrice',
            tableName: 'noteItem',
            parentTable: 'note',
            data: {
              remark: '修改数量价格:猪肉',
              oldData: {
                instockCnt: 10,
                price: 2
              },
              newData: {
                instockCnt: 10,
                price: 5
              }
            }
          }
        ],
        check(result) {
          CheckUtil.expectNotFind(result.result.content ?? [], { tableName: 'note', action: 'updateCntAndPrice' })
          checkNoteItemUpdateHis(
            findHis(result, item => item.tableName == 'noteItem' && item.action == 'updateCntAndPrice'),
            {
              action: 'updateCntAndPrice',
              oldPrice: 2,
              newPrice: 5,
              oldInstockCnt: 10,
              newInstockCnt: 10
            }
          )
        }
      }),
      new UpdateCntAndPrice({
        name: '修改入库价格和数量',
        changes: [
          { name: '猪肉', price: 4, instockCnt: 12, buyUnitFee: 1 }
        ]
      }).setRemark('updatePrice：单价 5→4，入库数量 10→12'),
      listNoteHis({
        name: '查询改价改量历史',
        remark: '同时改价格和入库数量：oldData/newData 都记，detail 含原来/新/价格/数量',
        checkArray: [
          {
            action: 'updateCntAndPrice',
            tableName: 'noteItem',
            parentTable: 'note',
            data: {
              remark: '修改数量价格:猪肉',
              oldData: {
                instockCnt: 10,
                price: 5
              },
              newData: {
                instockCnt: 12,
                price: 4
              }
            }
          }
        ],
        check(result) {
          CheckUtil.expectNotFind(result.result.content ?? [], { tableName: 'note', action: 'updateCntAndPrice' })
          checkNoteItemUpdateHis(
            findHis(result, item =>
              item.tableName == 'noteItem'
              && item.action == 'updateCntAndPrice'
              && item.data?.newData?.price == 4
            ),
            {
              action: 'updateCntAndPrice',
              oldPrice: 5,
              newPrice: 4,
              oldInstockCnt: 10,
              newInstockCnt: 12
            }
          )
        }
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'instocked'
      }).setRemark('取已入库分组，供结算'),
      new BatchProcessNote({
        action: 'statement'
      }).setRemark('批量结算，只记整单 note，不记 noteItem'),
      listNoteHis({
        name: '查询结算历史',
        remark: 'statement 只记 note，detail=title',
        checkArray: [
          {
            action: 'statement',
            tableName: 'note',
            parentTable: 'note',
            data: {
              remark: '结算'
            }
          }
        ],
        check(result) {
          CheckUtil.expectNotFind(result.result.content ?? [], { tableName: 'noteItem', action: 'statement' })
          checkNoteRow(findHis(result, item => item.tableName == 'note' && item.action == 'statement'), 'statement')
        }
      })
    ]
  }
}

class NoteAcceptSendHis extends TestCase {
  constructor() {
    super({ remark: '关联后第二单自动链接，供应商接单、发货并校验历史' })
  }

  getName(): string {
    return '接单发货修改历史'
  }

  protected buildActions(): BaseTest[] {
    return [
      new ChangeWarehouse().setRemark('切回餐厅，发第二单'),
      new Action({
        name: '第二单下单猪肉',
        remark: '已关联供应商，发单时自动生成链接单',
        url: '/app/note/createNote',
        method: 'post',
        param: {
          items: [
            {
              materialId: '${materialMap.猪肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 8,
              buyUnitFee: 1,
              stockUnitsId: 0,
              price: 3,
              stockBuyUnitFee: 1
            }
          ],
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result
          return {
            noteIds: ArrayUtil.toArray(content, 'noteId'),
            noteId: content[0].noteId
          }
        }
      }),
      new Action({
        name: '发送第二单',
        remark: 'sendNote 后供应商侧链接单为 normal，需手动接单',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }),
      new ChangeWarehouse2Supplier().setRemark('切到供应商仓，接单发货'),
      new QueryAction({
        name: '查询供应商待接单',
        url: '/app/note/listNote',
        query: {
          status: 'normal',
          warehouseId: '${supplierWarehouse.warehouseId}'
        }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content: any[] = result.result.content
          return {
            supplierNoteIds: ArrayUtil.toArray(content, 'noteId'),
            supplierNoteId: content[0].noteId
          }
        }
      }).setRemark('记下供应商链接单 noteId'),
      new Action({
        name: '供应商接单',
        remark: 'batchProcessNote accept，历史 action=accept',
        url: '/app/note/batchProcessNote',
        param: {
          noteIds: '${supplierNoteIds}',
          action: 'accept',
          type: 'Type4Supplier',
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
        }
      }),
      listNoteHis({
        name: '查询接单历史',
        remark: 'listNoteUpdateHis：整单接单 remark=接单，detail=title',
        noteId: '${supplierNoteId}',
        warehouseType: 'supplierWarehouse',
        checkArray: [
          {
            action: 'accept',
            tableName: 'note',
            parentTable: 'note',
            data: {
              remark: '接单'
            }
          }
        ],
        check(result) {
          checkNoteRow(findHis(result, item => item.tableName == 'note' && item.action == 'accept'), 'accept')
        }
      }),
      new Action({
        name: '供应商发货',
        remark: 'batchProcessNote send，历史 action=sended',
        url: '/app/note/batchProcessNote',
        param: {
          noteIds: '${supplierNoteIds}',
          action: 'send',
          type: 'Type4Supplier',
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
        }
      }),
      listNoteHis({
        name: '查询发货历史',
        remark: 'send 只记整单 note，不记 noteItem',
        noteId: '${supplierNoteId}',
        warehouseType: 'supplierWarehouse',
        checkArray: [
          {
            action: 'sended',
            tableName: 'note',
            parentTable: 'note',
            data: {
              remark: '发货'
            }
          }
        ],
        check(result) {
          CheckUtil.expectNotFind(result.result.content ?? [], { tableName: 'noteItem', action: 'sended' })
          checkNoteRow(findHis(result, item => item.tableName == 'note' && item.action == 'sended'), 'sended')
        }
      })
    ]
  }
}

import { ArrayUtil, BaseTest, CheckUtil, DateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";
import ListMaterial from "../../action/material/ListMaterial";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import QueryAction from "../../action/QueryAction";

/**
 * 牛肉规格包→1包=100g：用不同 buyUnitFee（克=100、包=1）测盘点/入库/销售/退货与 analysyMaterial。
 * 详见同目录 FlowBeefAnalyseMaterial.md。
 *
 * FIFO 推算（标准单位=包；克用 buyUnitFee=100）：
 * - 7/1 盘点 30g(fee100)/30元
 * - 7/2 入库 3包(fee1)/450元 → 合计等价 330g / 480元
 * - 7/3 销售 120g（12份×10g）：先扣盘点30/30，再扣入库90g/135 → 余 210g / 315
 * - 7/4 退货 1包（FIFO@150）→ 110g / 165
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '牛肉不同buyUnitFee：盘点30g(fee100)→入库3包(fee1)→销售120g→退货1包→盘0' })
  }

  getName(): string {
    return '牛肉analysyMaterial'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new PreTest({
        materialsOpts: [
          { name: '牛肉', category: '肉类', unit: '包', code: 'MAT_BEEF' }
        ]
      }),

      new Action({
        name: '转化规格:牛肉(1包=100克)',
        remark: 'saveBuyUnit：克+包，1包=100克；标准单位仍为包；按克操作 buyUnitFee=100',
        url: '/app/material/saveBuyUnit',
        param: {
          materialId: '${materialMap.牛肉.materialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          supplierUnitsName: '包'
        }
      }),
      new ListMaterial(),

      new SetupProductBom(),

      new Action({
        name: '7月1日盘点30g',
        remark: '牛肉 cnt=30, buyUnitFee=100（克）, cost=30，单价1元/g',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-07-01',
          array: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 30,
              buyUnitFee: 100,
              cost: 30
            }
          ]
        }
      }),

      new OrderInstockJuly2(),

      new Recal().setRemark('盘点+入库后重算'),

      new UploadSalesJuly3(),

      new BackJuly4(),

      new Recal().setRemark('退货改期后重算'),

      ...this.buildVerifyStock({
        remark: '校验退货后库存：110g(fee100)/165元',
        name: '校验退货后库存',
        cnt: 110,
        buyUnitFee: 100,
        cost: 165
      }, variable),

      new Action({
        name: '7月30日盘点为0',
        remark: '期末盘点清零（buyUnitFee=100）',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-07-30',
          array: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 0,
              buyUnitFee: 100,
              cost: 0
            }
          ]
        }
      }),

      new Recal().setRemark('期末盘点后重算'),

      new Action({
        name: 'analysyMaterial',
        remark: '用量差异：begin=7/1 end=7/30，校验牛肉行',
        url: '/app/state/analysyMaterial',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          begin: '2026-07-01',
          end: '2026-07-30'
        }
      }, {
        check(result) {
          let content = result.result?.content ?? []
          let beefId = variable.materialMap?.牛肉?.materialId
          let row = content.find((r: any) => String(r.materialId) === String(beefId))
          CheckUtil.expectEqual(row != null, true, 'analysyMaterial应有牛肉行')
          CheckUtil.expectEqual(!!row.hasBeginInventory, true, '应有期初盘点')
          CheckUtil.expectEqual(!!row.hasEndInventory, true, '应有期末盘点')
          CheckUtil.expectEqual(!!row.hasMidInventory, false, '期中不应有盘点')
          /**
           * 用量口径（仅 sales+inventory，克 fee=100）：
           * 7/1盘点 +30 → 贡献 -30；销售 +120；7/30盘亏 -110 → 贡献 +110
           * allStock.cnt = 200，allStock.cost = 300；全部分摊到唯一餐品
           * BOM 1元/g：theoryCost=120；costByBomPrice=200
           * diffByCnt=80；diffByPrice=100；diff=180
           */
          CheckUtil.expectEqual(row.cost, 300, '实际成本(分摊后)应为300')
          CheckUtil.expectEqual(row.theoryCost, 120, '理论成本应为120')
          CheckUtil.expectEqual(row.diff, 180, 'diff应为180')
          CheckUtil.expectEqual(row.diffByCnt, 80, 'diffByCnt应为80')
          CheckUtil.expectEqual(row.diffByPrice, 100, 'diffByPrice应为100')
        }
      })
    ]
  }

  private buildVerifyStock(opt: {
    remark: string
    name: string
    cnt: number
    buyUnitFee: number
    cost: number
  }, variable: any): BaseTest[] {
    return [
      new VerifyStep({
        remark: opt.remark,
        name: opt.name,
        actions: [
          new Recal().setRemark(`${opt.remark}·重算`),
          new CheckStock({
            array: [{
              materialId: '${materialMap.牛肉.materialId}',
              cnt: opt.cnt,
              buyUnitFee: opt.buyUnitFee
            }]
          }).setRemark(`${opt.remark}·CheckStock`),
          new CheckArray([{
            table: 'stock',
            check(array) {
              let materialId = variable.materialMap?.牛肉?.materialId
              let stock = array.find((row: any) => String(row.materialId) === String(materialId))
              CheckUtil.expectEqual(stock != null, true, '牛肉库存不存在')
              CheckUtil.expectEqual(stock.cost, opt.cost, `牛肉库存金额应为${opt.cost}`)
            }
          }]).setRemark(`${opt.remark}·校验金额`)
        ]
      })
    ]
  }
}

/** 红烧牛肉：BOM 每份 10g(fee100)，理论价 1元/g */
class SetupProductBom extends TestCase {
  constructor() {
    super({ remark: '增加红烧牛肉并设置BOM：10g/份(buyUnitFee=100)，理论价1元/g' })
  }

  getName(): string {
    return '设置餐品BOM'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '增加餐品红烧牛肉',
        remark: 'addProduct',
        url: '/app/product/addProduct',
        param: { name: '红烧牛肉' }
      }, {
        buildVariable(result) {
          return { productId: result.result.productId }
        }
      }),
      new Action({
        name: '保存BOM',
        remark: '每份消耗牛肉10g(fee100)，price=1元/g',
        url: '/app/bom/saveBom',
        param: {
          productId: '${productId}',
          boms: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 10,
            buyUnitFee: 100,
            yieldRate: 1,
            netCnt: 10,
            price: 1,
            stockBuyUnitFee: 100
          }]
        }
      }),
      new Action({
        name: '查询餐品',
        remark: '拿到 productMap',
        url: '/app/product/listProduct',
        param: {}
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content
          return {
            product: ArrayUtil.toMapByKey(content, 'name', 'productId')
          }
        }
      })
    ]
  }
}

/** 7月2日订单入库 3包/450元（按包 buyUnitFee=1） */
class OrderInstockJuly2 extends TestCase {
  constructor() {
    super({ remark: '7月2日订单入库：牛肉3包(buyUnitFee=1)/450元（1.5元/g）' })
  }

  getName(): string {
    return '7月2日订单入库'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote(牛3包)',
        remark: '下单牛肉3包(fee1)，450元',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 3,
            buyUnitFee: 1,
            price: 150,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result
          return {
            noteIds: ArrayUtil.toArray(content, 'noteId'),
            note: content[0]
          }
        }
      }),
      new Action({
        name: '发送订单',
        remark: 'sendNote',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal'
      }),
      new Action({
        name: '入库processNote',
        remark: '全量入库',
        url: '/app/note/processNote',
        param: {
          noteId: '${note.noteId}',
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(ret: any, variable: any) {
          let noteItems: any[] = variable.note.noteItems
          ret.noteItems = noteItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            cnt: row.cnt,
            instockCnt: row.cnt,
            price: row.price,
            stockBuyUnitFee: row.stockBuyUnitFee,
            materialId: row.materialId,
            yieldRate: 0
          }))
          return ret
        }
      }),
      new Action({
        name: '修改订单时间为7月2日',
        remark: 'updateNoteTime → 2026-07-02',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${note.noteId}',
          sysAddTime: '2026-07-02 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ]
  }
}

/** 7月3日销售红烧牛肉12份 → 消耗120g（BOM 10g×12，fee100） */
class UploadSalesJuly3 extends TestCase {
  constructor() {
    super({ remark: '7月3日销售红烧牛肉12份 → 牛肉-120g(fee100)' })
  }

  getName(): string {
    return '7月3日销售'
  }

  protected buildActions(): BaseTest[] {
    let excelDay = DateUtil.toExcelDateNum(DateUtil.parse('2026-07-03'))
    return [
      new Action({
        name: '上传销售记录',
        remark: '红烧牛肉12份，业务日2026-07-03',
        url: '/app/salesRecord/importSalesRecord',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          datas: [{
            product: {
              name: '红烧牛肉',
              id: '${product.红烧牛肉}'
            },
            salesRecord: { name: excelDay },
            cnt: { name: 12 }
          }]
        }
      })
    ]
  }
}

/** 7月4日从7/2订单退货1包（fee1） */
class BackJuly4 extends TestCase {
  constructor() {
    super({ remark: '7月4日退货牛肉1包(buyUnitFee=1)，金额按FIFO' })
  }

  getName(): string {
    return '7月4日退货'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '查询订单明细',
        remark: '取 noteItem 作退货源',
        url: '/app/noteItem/listNoteItem',
        param: { noteId: '${note.noteId}' }
      }, {
        buildVariable(result) {
          return { backSrcItems: result.result.content }
        }
      }),
      new Action({
        name: '创建退货单',
        remark: '退牛肉1包(fee1)',
        url: '/app/noteBack/createNoteBack',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(ret: any, variable: any) {
          ret.items = variable.backSrcItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            stockUnitsId: row.stockUnitsId,
            cnt: 1,
            buyUnitFee: 1,
            price: row.price,
            supplierId: row.supplierId,
            materialId: row.materialId,
            stockBuyUnitFee: 1
          }))
          return ret
        }
      }),
      new QueryAction({
        name: '查询退货单',
        url: '/app/note/listNote',
        query: {
          status: 'instocked',
          type: 'back'
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content
          return { backNoteId: content[0].noteId }
        }
      }),
      new Action({
        name: '修改退货单时间为7月4日',
        remark: 'updateNoteTime → 2026-07-04',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${backNoteId}',
          sysAddTime: '2026-07-04 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ]
  }
}

class VerifyStep extends TestCase {
  private opt: { remark: string; name: string; actions: BaseTest[] }

  constructor(opt: VerifyStep['opt']) {
    super({ remark: opt.remark })
    this.opt = opt
  }

  getName(): string {
    return this.opt.name
  }

  protected buildActions(): BaseTest[] {
    return this.opt.actions
  }
}

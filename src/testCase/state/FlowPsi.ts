import { ArrayUtil, BaseTest, CheckUtil, DownloadExcelAction, TestCase } from "testflow";
import PreTestWithMeat from "../PreTestWithMeat";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";
import AddMaterial from "../../action/material/AddMaterial";
import ListMaterial from "../../action/material/ListMaterial";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import QueryAction from "../../action/QueryAction";

/**
 * 进销存报表 `/app/state/psi`（见同目录 FlowPsi.md）。
 *
 * 采购口径=入库类（订单+手工−退货）；出库=入库以外类型（数量金额×-1）；
 * 数量按物料默认采购单位换算成数字；单价=金额/数量（数量为0则单价为0）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '进销存psi：期初盘点→订单/手工入库→报损/退货/盘亏→校验excel，7/1边界不进6月' })
  }

  getName(): string {
    return '进销存psi'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new PreTestWithMeat(),

      new AddCabbage(),

      new Action({
        name: '5月30日盘点(除羊肉)',
        remark: '牛肉2包/猪肉300g/白菜100g @1元/g；羊肉不盘，期初应为0',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-05-30',
          array: [
            { materialId: '${materialMap.牛肉.materialId}', cnt: 2, buyUnitFee: 1, cost: 200 },
            { materialId: '${materialMap.猪肉.materialId}', cnt: 300, buyUnitFee: 1, cost: 300 },
            { materialId: '${materialMap.白菜.materialId}', cnt: 100, buyUnitFee: 1, cost: 100 }
          ]
        }
      }),

      new OrderInstockJune1(),

      new Action({
        name: '6月15日手工入库',
        remark: '牛肉1包/羊肉100g/猪肉100g @3元/g，salesDay=2026-06-15',
        url: '/app/note/createHandInstock',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          salesDay: '2026-06-15',
          items: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 1, buyUnitFee: 1, cost: 300, price: 300, stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.羊肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 100, buyUnitFee: 1, cost: 300, price: 3, stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.猪肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 100, buyUnitFee: 1, cost: 300, price: 3, stockBuyUnitFee: 1
            }
          ]
        }
      }),

      new OtherUseJune20(),

      new BackJune29(),

      new Action({
        name: '6月30日盘点',
        remark: '牛4包(盘亏1包清@1)、羊200g(盘亏100g@2)；猪肉/白菜不盘',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-06-30',
          array: [
            { materialId: '${materialMap.牛肉.materialId}', cnt: 4, buyUnitFee: 1, cost: 900 },
            { materialId: '${materialMap.羊肉.materialId}', cnt: 200, buyUnitFee: 1, cost: 500 }
          ]
        }
      }),

      ...this.buildVerify({
        name: '校验6月30日盘点后库存',
        remark: '牛4包(900)/羊200(500)/猪700(1400)/白菜100(100)',
        stocks: [
          { name: '牛肉', cnt: 4, buyUnitFee: 1, cost: 900 },
          { name: '羊肉', cnt: 200, buyUnitFee: 1, cost: 500 },
          { name: '猪肉', cnt: 700, buyUnitFee: 1, cost: 1400 },
          { name: '白菜', cnt: 100, buyUnitFee: 1, cost: 100 }
        ]
      }, variable),

      new Action({
        name: '7月1日手工入库(边界)',
        remark: '牛肉1包 @4元/g，salesDay=2026-07-01，压在 end+1天 上，不能进6月psi',
        url: '/app/note/createHandInstock',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          salesDay: '2026-07-01',
          items: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 1, buyUnitFee: 1, cost: 400, price: 400, stockBuyUnitFee: 1
            }
          ]
        }
      }),

      ...this.buildVerify({
        name: '校验7月1日入库后库存',
        remark: '7/1已生效：牛5包(1300)；psi仍按6月末 牛4包(900)',
        stocks: [
          { name: '牛肉', cnt: 5, buyUnitFee: 1, cost: 1300 },
          { name: '羊肉', cnt: 200, buyUnitFee: 1, cost: 500 },
          { name: '猪肉', cnt: 700, buyUnitFee: 1, cost: 1400 },
          { name: '白菜', cnt: 100, buyUnitFee: 1, cost: 100 }
        ]
      }, variable),

      this.buildPsiCheck()
    ]
  }

  private buildVerify(opt: {
    name: string
    remark: string
    stocks: Array<{ name: string; cnt: number; buyUnitFee: number; cost: number }>
  }, variable: any): BaseTest[] {
    return [
      new VerifyStep({
        name: opt.name,
        remark: opt.remark,
        actions: [
          new Recal().setRemark(`${opt.remark}·重算`),
          new CheckStock({
            array: opt.stocks.map(row => ({
              materialId: `\${materialMap.${row.name}.materialId}`,
              cnt: row.cnt,
              buyUnitFee: row.buyUnitFee
            }))
          }).setRemark(`${opt.remark}·CheckStock`),
          new CheckArray([{
            table: 'stock',
            check(array) {
              for (let expect of opt.stocks) {
                let materialId = variable.materialMap?.[expect.name]?.materialId
                let stock = array.find((row: any) => String(row.materialId) === String(materialId))
                CheckUtil.expectEqual(stock != null, true, `${opt.name}:${expect.name}库存不存在`)
                CheckUtil.expectEqual(stock.cost, expect.cost,
                  `${opt.name}:${expect.name}库存金额不对，期望${expect.cost}，实际${stock?.cost}`)
              }
            }
          }]).setRemark(`${opt.remark}·校验金额`)
        ]
      })
    ]
  }

  /**
   * 进销存 6/1~6/30。数量按默认采购单位：羊/牛=包，猪/白菜=克。
   * 单价=金额/数量，除数为0时为0；800/3 截断为 266.66。
   */
  private buildPsiCheck(): BaseTest {
    let expects = {
      羊肉: {
        '规格': '1包=100克',
        '期初数量': 0, '期初金额': 0, '期初价格': 0,
        '采购数量': 4, '采购金额': 900, '采购单价': 225,
        '出库数量': 2, '出库金额': 400, '出库单价': 200,
        '期末数量': 2, '期末金额': 500, '期末单价': 250
      },
      牛肉: {
        '规格': '1包=100克',
        '期初数量': 2, '期初金额': 200, '期初价格': 100,
        '采购数量': 3, '采购金额': 800, '采购单价': 266.66,
        '出库数量': 1, '出库金额': 100, '出库单价': 100,
        '期末数量': 4, '期末金额': 900, '期末单价': 225
      },
      猪肉: {
        '规格': '克',
        '期初数量': 300, '期初金额': 300, '期初价格': 1,
        '采购数量': 500, '采购金额': 1200, '采购单价': 2.4,
        '出库数量': 100, '出库金额': 100, '出库单价': 1,
        '期末数量': 700, '期末金额': 1400, '期末单价': 2
      },
      白菜: {
        '规格': '克',
        '期初数量': 100, '期初金额': 100, '期初价格': 1,
        '采购数量': 0, '采购金额': 0, '采购单价': 0,
        '出库数量': 0, '出库金额': 0, '出库单价': 0,
        '期末数量': 100, '期末金额': 100, '期末单价': 1
      }
    }
    let sumExpects = {
      '期初金额': 600, '采购金额': 2900, '出库金额': 600, '期末金额': 2900
    }
    return new DownloadExcelAction({
      name: '进销存excel校验',
      remark: '下载 psi excel（6/1~6/30），核对4物料行与汇总金额；7/1入库不得计入',
      url: '/app/state/psi',
      sheetName: '进销存',
      highlight:true,
      param: {
        begin: '2026-06-01',
        end: '2026-06-30',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(rows: any[]) {
        CheckUtil.expectEqual(rows.length, 5, `进销存行数应为4物料+1汇总，实际${rows.length}`)
        for (let name in expects) {
          let row = rows.find(r => r['物料名称'] == name)
          CheckUtil.expectEqual(row != null, true, `进销存缺少${name}行`)
          let expect = expects[name]
          for (let col in expect) {
            CheckUtil.expectEqual(row[col], expect[col],
              `进销存:${name}.${col}，期望${expect[col]}，实际${row?.[col]}`)
          }
        }
        let sumRow = rows.find(r => r['物料名称'] == '汇总')
        CheckUtil.expectEqual(sumRow != null, true, '进销存缺少汇总行')
        for (let col in sumExpects) {
          CheckUtil.expectEqual(sumRow[col], sumExpects[col],
            `进销存:汇总.${col}，期望${sumExpects[col]}，实际${sumRow?.[col]}`)
        }
      }
    })
  }
}

/** 增加白菜：6月内无任何流水，验证仅期初物料仍出现在表中。 */
class AddCabbage extends TestCase {
  constructor() {
    super({ remark: '增加白菜（全月无变化，仅期初仍出现在psi）' })
  }

  getName(): string {
    return '增加白菜'
  }

  protected buildActions(): BaseTest[] {
    return [
      new AddMaterial('白菜', {
        buyUnit: [{ name: '克', fee: 1, isSupplier: true }],
        categoryId: '${categoryMap.蔬菜}',
        code: 'MAT004'
      }).setRemark('增加白菜，单位克'),
      new ListMaterial().setRemark('刷新 materialMap，拿到白菜')
    ]
  }
}

/**
 * 6月1日订单入库：createNote → sendNote → processNote，再 updateNoteTime 到 6/1。
 * 2元/克：牛肉200元/包，羊/猪 price=2。
 */
class OrderInstockJune1 extends TestCase {
  constructor() {
    super({ remark: '6月1日订单入库：牛肉3包/羊肉4包/猪肉500g @2元/g' })
  }

  getName(): string {
    return '6月1日订单入库'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote(牛3包/羊4包/猪500g)',
        remark: '下单：牛肉3包、羊肉4包、猪肉500g，2元/g',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 3, buyUnitFee: 1, price: 200, stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.羊肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 4, buyUnitFee: -100, price: 2, stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.猪肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 500, buyUnitFee: 1, price: 2, stockBuyUnitFee: 1
            }
          ]
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
        remark: 'sendNote，状态 normal',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }),

      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal'
      }).setRemark('查询订单分组，供入库使用'),

      new Action({
        name: '入库processNote',
        remark: '按订单明细全量入库',
        url: '/app/note/processNote',
        param: {
          noteId: '${note.noteId}',
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(ret: any, variable: any) {
          let noteItems: any[] = variable.note.noteItems
          ret.noteItems = noteItems.map(row => ({
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
        name: '修改订单时间为6月1日',
        remark: 'updateNoteTime：同步改 note.createTime 与入库流水业务日并重算',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${note.noteId}',
          sysAddTime: '2026-06-01 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ]
  }
}

/** 6月20日其他消耗：报损羊肉100g、猪肉100g（FIFO 扣最旧批次）。 */
class OtherUseJune20 extends TestCase {
  constructor() {
    super({ remark: '6月20日报损：羊肉100g、猪肉100g（otherUse，FIFO）' })
  }

  getName(): string {
    return '6月20日其他消耗'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '查询消耗类型',
        remark: '拉取 OtherType，拿到报损 id',
        url: '/app/otherType/listOtherType',
        param: {}
      }, {
        buildVariable(result) {
          let content = result.result.content ?? []
          return {
            otherTypeMap: ArrayUtil.toMapByKey(content, 'name', 'otherTypeId')
          }
        }
      }),
      new Action({
        name: '保存其他消耗(6月20日)',
        remark: '报损：羊肉100g + 猪肉100g，createTime=2026-06-20',
        url: '/app/otherUse/saveOtherUse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherTypeMap.报损}',
          remark: '6月20日报损',
          createTime: '2026-06-20',
          otherItems: [
            { materialId: '${materialMap.羊肉.materialId}', cnt: 100, buyUnitFee: 1 },
            { materialId: '${materialMap.猪肉.materialId}', cnt: 100, buyUnitFee: 1 }
          ]
        }
      })
    ]
  }
}

/**
 * 6月29日退货：从6/1订单退 牛肉1包、羊肉1包、猪肉100g，
 * 再用 updateNoteTime 把退货单时间改到 6/29。
 */
class BackJune29 extends TestCase {
  constructor() {
    super({ remark: '6月29日退货：牛肉1包/羊肉1包/猪肉100g，金额按FIFO最旧批次' })
  }

  getName(): string {
    return '6月29日退货'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '查询6/1订单明细',
        remark: '取 noteItem 作退货源',
        url: '/app/noteItem/listNoteItem',
        param: {
          noteId: '${note.noteId}'
        }
      }, {
        buildVariable(result) {
          return { backSrcItems: result.result.content }
        }
      }),

      new Action({
        name: '创建退货单',
        remark: '退：牛肉1包(fee1)/羊肉1包(fee-100)/猪肉100g',
        url: '/app/noteBack/createNoteBack',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(ret: any, variable: any) {
          let cntMap = {
            [variable.materialMap.牛肉.materialId]: 1,
            [variable.materialMap.羊肉.materialId]: 1,
            [variable.materialMap.猪肉.materialId]: 100
          }
          ret.items = variable.backSrcItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            stockUnitsId: row.stockUnitsId,
            cnt: cntMap[row.materialId],
            buyUnitFee: row.buyUnitFee,
            price: row.price,
            supplierId: row.supplierId,
            materialId: row.materialId,
            stockBuyUnitFee: row.stockBuyUnitFee
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
      }).setRemark('查出刚创建的退货单 noteId'),

      new Action({
        name: '修改退货单时间为6月29日',
        remark: 'updateNoteTime：退货业务日改到 6/29',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${backNoteId}',
          sysAddTime: '2026-06-29 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ]
  }
}

/** Recal+校验 */
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

import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import StockUtil from "../../util/StockUtil";
import PreTestWithMeat from "../PreTestWithMeat";
import AddMaterial from "../../action/material/AddMaterial";
import ListMaterial from "../../action/material/ListMaterial";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";
import CheckCnt from "../../action/CheckCnt";
import ListNoteGroup from "../../action/note/ListNoteGroup";

/**
 * 其他消耗全流程（见同目录 FlowOtherUse.md）。
 *
 * 物料规格见 PreTestWithMeat：
 * - 羊肉/猪肉：标准单位=克；按包用 buyUnitFee=-100
 * - 牛肉：标准单位=包；按包用 buyUnitFee=1
 * - 西瓜：标准单位=个；buyUnitFee=1，其他入库单价 10 元/个
 *
 * 库存时间轴：
 * - 5/1、6/1 盘点（绝对库存，1元/g）
 * - 7/1 createNote→发送→入库（累加，2元/g），再 updateNoteTime 改业务日
 * - 之后 OtherUse 增删改与改日期（isAdd=0）
 * - 删除后再做其他入库（isAdd=1，赠予）：含西瓜 5 个，再改为 8 个并删除猪肉
 *
 * md「牛肉改为1包50g」按 1包+50g=150g=1.5包；「周肉」按猪肉。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '其他消耗：盘点→订单入库→消耗→改明细→改日期→删除→其他入库，并校验库存和金额' })
  }

  getName(): string {
    return '其他消耗'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new PreTestWithMeat(),
      new AddMaterial('西瓜', {
        buyUnit: [{ name: '个', fee: 1 }],
        categoryId: '${categoryMap.蔬菜}',
        code: 'MAT004'
      }),
      new ListMaterial(),

      this.buildInventoryAction({
        remark: '5月1日盘点：牛肉1包、羊肉2包、猪肉300g，单价1元/g',
        name: '5月1日盘点',
        day: '2026-05-01',
        yuanPerGram: 1,
        items: [
          { name: '牛肉', cnt: 1, buyUnitFee: 1, grams: 100 },
          { name: '羊肉', cnt: 2, buyUnitFee: -100, grams: 200 },
          { name: '猪肉', cnt: 300, buyUnitFee: 1, grams: 300 }
        ]
      }),

      this.buildInventoryAction({
        remark: '6月1日盘点：牛肉2包、羊肉3包、猪肉400g，单价1元/g',
        name: '6月1日盘点',
        day: '2026-06-01',
        yuanPerGram: 1,
        items: [
          { name: '牛肉', cnt: 2, buyUnitFee: 1, grams: 200 },
          { name: '羊肉', cnt: 3, buyUnitFee: -100, grams: 300 },
          { name: '猪肉', cnt: 400, buyUnitFee: 1, grams: 400 }
        ]
      }),

      new OrderInstockJuly1(),

      // 6/1盘点(2/3/400) + 7/1订单(+3/+4/+500) → 5包/7包/900g
      ...this.buildVerify({
        remark: '校验7月1日订单入库后库存：牛5包/羊7包/猪900g',
        name: '校验订单入库后库存',
        stocks: [
          { name: '牛肉', cnt: 5, buyUnitFee: 1, cost: 800 },
          { name: '羊肉', cnt: 7, buyUnitFee: -100, cost: 1100 },
          { name: '猪肉', cnt: 900, buyUnitFee: 1, cost: 1400 }
        ]
      }, variable),

      new AddOtherUseJuly2(),

      // 消耗牛1包+羊1包（FIFO先扣6/1的1元/g）→ 4包/6包/900g
      ...this.buildVerify({
        remark: '7/2消耗牛1包+羊1包后：牛4包/羊6包/猪900g',
        name: '校验新增消耗后库存',
        stocks: [
          { name: '牛肉', cnt: 4, buyUnitFee: 1, cost: 700 },
          { name: '羊肉', cnt: 6, buyUnitFee: -100, cost: 1000 },
          { name: '猪肉', cnt: 900, buyUnitFee: 1, cost: 1400 }
        ],
        otherUseCnt: 1,
        otherItemCnt: 2,
        otherUseStockRecordCnt: 2
      }, variable),

      new Action({
        name: '更改OtherItem',
        remark: '改明细：牛肉1.5包(1包+50g)、删除羊肉、增加猪肉300g',
        url: '/app/otherUse/saveOtherUse',
        param: {
          otherUseId: '${otherUseId}',
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherTypeMap.报损}',
          isAdd: 0,
          remark: '改明细',
          createTime: '2026-07-02',
          otherItems: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 1.5,
              buyUnitFee: 1
            },
            {
              materialId: '${materialMap.猪肉.materialId}',
              cnt: 300,
              buyUnitFee: 1
            }
          ]
        }
      }),

      // 相对订单后基数：牛5-1.5=3.5，羊7，猪900-300=600
      ...this.buildVerify({
        remark: '改明细后：牛3.5包/羊7包/猪600g',
        name: '校验改明细后库存',
        stocks: [
          { name: '牛肉', cnt: 3.5, buyUnitFee: 1, cost: 650 },
          { name: '羊肉', cnt: 7, buyUnitFee: -100, cost: 1100 },
          { name: '猪肉', cnt: 600, buyUnitFee: 1, cost: 1100 }
        ],
        otherUseCnt: 1,
        otherItemCnt: 2,
        otherUseStockRecordCnt: 2
      }, variable),

      this.buildChangeDayAction({
        remark: '改业务日到6月2日(落在6/1盘点与7/1订单之间)',
        name: '改日期为6月2日',
        day: '2026-06-02'
      }),
      // 6/1后消耗再叠加7/1订单 → 仍为 3.5/7/600
      ...this.buildVerify({
        remark: '日期改到6/2后：6/1盘点−消耗+7/1订单 → 牛3.5/羊7/猪600',
        name: '校验改到6月2日后库存',
        stocks: [
          { name: '牛肉', cnt: 3.5, buyUnitFee: 1, cost: 650 },
          { name: '羊肉', cnt: 7, buyUnitFee: -100, cost: 1100 },
          { name: '猪肉', cnt: 600, buyUnitFee: 1, cost: 1100 }
        ],
        otherUseCnt: 1,
        otherItemCnt: 2,
        otherUseStockRecordCnt: 2
      }, variable),

      this.buildChangeDayAction({
        remark: '改业务日到5月2日(落在5/1与6/1盘点之间)',
        name: '改日期为5月2日',
        day: '2026-05-02'
      }),
      // 5/2消耗后被6/1绝对盘点覆盖，再+7/1订单 → 5/7/900
      ...this.buildVerify({
        remark: '日期改到5/2后：被6/1盘点覆盖再加7/1订单 → 牛5/羊7/猪900',
        name: '校验改到5月2日后库存',
        stocks: [
          { name: '牛肉', cnt: 5, buyUnitFee: 1, cost: 800 },
          { name: '羊肉', cnt: 7, buyUnitFee: -100, cost: 1100 },
          { name: '猪肉', cnt: 900, buyUnitFee: 1, cost: 1400 }
        ],
        otherUseCnt: 1,
        otherItemCnt: 2,
        otherUseStockRecordCnt: 2
      }, variable),

      this.buildChangeDayAction({
        remark: '改业务日到7月10日(在7/1订单之后，消耗生效)',
        name: '改日期为7月10日',
        day: '2026-07-10'
      }),
      ...this.buildVerify({
        remark: '日期改到7/10后消耗生效：牛3.5包/羊7包/猪600g',
        name: '校验改到7月10日后库存',
        stocks: [
          { name: '牛肉', cnt: 3.5, buyUnitFee: 1, cost: 650 },
          { name: '羊肉', cnt: 7, buyUnitFee: -100, cost: 1100 },
          { name: '猪肉', cnt: 600, buyUnitFee: 1, cost: 1100 }
        ],
        otherUseCnt: 1,
        otherItemCnt: 2,
        otherUseStockRecordCnt: 2
      }, variable),

      new Action({
        name: '删除其他消耗',
        remark: '删除 OtherUse，库存应回到仅盘点+订单：牛5/羊7/猪900',
        url: '/app/otherUse/delOtherUse',
        param: {
          otherUseId: '${otherUseId}',
          warehouseId: '${warehouse.warehouseId}'
        }
      }),

      ...this.buildVerify({
        remark: '删除后库存回到牛5包/羊7包/猪900g',
        name: '校验删除后库存',
        stocks: [
          { name: '牛肉', cnt: 5, buyUnitFee: 1, cost: 800 },
          { name: '羊肉', cnt: 7, buyUnitFee: -100, cost: 1100 },
          { name: '猪肉', cnt: 900, buyUnitFee: 1, cost: 1400 }
        ],
        otherUseCnt: 0,
        otherItemCnt: 0,
        otherUseStockRecordCnt: 0
      }, variable),

      new AddOtherInstockJuly3(),

      // 删除后基数 牛5/800、羊7/1100、猪900/1400
      // 入库：牛肉2包×50元=100，猪肉100g×3元=300，西瓜5个×10元=50
      ...this.buildVerify({
        remark: '7/3其他入库后：牛7包/羊7包/猪1000g/西瓜5个，金额100+300+50',
        name: '校验其他入库后库存',
        stocks: [
          { name: '牛肉', cnt: 7, buyUnitFee: 1, cost: 900 },
          { name: '羊肉', cnt: 7, buyUnitFee: -100, cost: 1100 },
          { name: '猪肉', cnt: 1000, buyUnitFee: 1, cost: 1700 },
          { name: '西瓜', cnt: 5, buyUnitFee: 1, cost: 50 }
        ],
        otherUseCnt: 1,
        otherItemCnt: 3,
        otherUseStockRecordCnt: 0,
        instock: {
          otherUseCost: 450,
          lines: [
            { name: '牛肉', cnt: 2, buyUnitFee: 1, price: 50, stockBuyUnitFee: 1, cost: 100 },
            { name: '猪肉', cnt: 100, buyUnitFee: 1, price: 3, stockBuyUnitFee: 1, cost: 300 },
            { name: '西瓜', cnt: 5, buyUnitFee: 1, price: 10, stockBuyUnitFee: 1, cost: 50 }
          ]
        }
      }, variable),

      new Action({
        name: '更改其他入库',
        remark: '西瓜改为8个，删除猪肉；牛肉2包保持不变',
        url: '/app/otherUse/saveOtherUse',
        param: {
          otherUseId: '${otherInstockId}',
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherInstockTypeId}',
          isAdd: 1,
          remark: '7月3日其他入库',
          createTime: '2026-07-03',
          otherItems: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 2,
              buyUnitFee: 1,
              price: 50,
              stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.西瓜.materialId}',
              cnt: 8,
              buyUnitFee: 1,
              price: 10,
              stockBuyUnitFee: 1
            }
          ]
        }
      }),

      // 去掉猪肉入库后回到 900g/1400；西瓜 8×10=80；牛肉仍 +100
      ...this.buildVerify({
        remark: '改其他入库后：西瓜8个，猪肉回到900g，牛肉仍为7包',
        name: '校验更改其他入库后库存',
        stocks: [
          { name: '牛肉', cnt: 7, buyUnitFee: 1, cost: 900 },
          { name: '羊肉', cnt: 7, buyUnitFee: -100, cost: 1100 },
          { name: '猪肉', cnt: 900, buyUnitFee: 1, cost: 1400 },
          { name: '西瓜', cnt: 8, buyUnitFee: 1, cost: 80 }
        ],
        otherUseCnt: 1,
        otherItemCnt: 2,
        otherUseStockRecordCnt: 0,
        instock: {
          otherUseCost: 180,
          lines: [
            { name: '牛肉', cnt: 2, buyUnitFee: 1, price: 50, stockBuyUnitFee: 1, cost: 100 },
            { name: '西瓜', cnt: 8, buyUnitFee: 1, price: 10, stockBuyUnitFee: 1, cost: 80 }
          ]
        }
      }, variable)
    ]
  }

  private buildInventoryAction(opt: {
    remark: string
    name: string
    day: string
    yuanPerGram: number
    items: Array<{ name: string; cnt: number; buyUnitFee: number; grams: number }>
  }): Action {
    let yuan = opt.yuanPerGram
    return new Action({
      name: opt.name,
      remark: opt.remark,
      url: '/app/inventory/setInventoryByArray',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        bussinessDate: opt.day,
        array: opt.items.map(row => ({
          materialId: `\${materialMap.${row.name}.materialId}`,
          cnt: row.cnt,
          buyUnitFee: row.buyUnitFee,
          cost: row.grams * yuan
        }))
      }
    })
  }

  private buildChangeDayAction(opt: { remark: string; name: string; day: string }): Action {
    return new Action({
      name: opt.name,
      remark: opt.remark,
      url: '/app/otherUse/updateOtherUseInfo',
      param: {
        otherUseId: '${otherUseId}',
        warehouseId: '${warehouse.warehouseId}',
        createTime: opt.day,
        remark: `业务日${opt.day}`
      }
    })
  }

  private buildVerify(opt: {
    remark: string
    name: string
    stocks: Array<{ name: string; cnt: number; buyUnitFee: number; cost: number }>
    otherUseCnt?: number
    otherItemCnt?: number
    otherUseStockRecordCnt?: number
    instock?: {
      otherUseCost: number
      lines: Array<{
        name: string
        cnt: number
        buyUnitFee: number
        price: number
        stockBuyUnitFee: number
        cost: number
      }>
    }
  }, variable: any): BaseTest[] {
    let actions: BaseTest[] = [
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
            CheckUtil.expectEqual(stock.cost, expect.cost, `${opt.name}:${expect.name}库存金额不对`)
          }
        }
      }]).setRemark(`${opt.remark}·校验金额`)
    ]
    if (opt.otherUseCnt != null) {
      actions.push(new CheckCnt([
        { table: 'otherUse', cnt: opt.otherUseCnt },
        { table: 'otherItem', cnt: opt.otherItemCnt },
        {
          table: 'stockRecord',
          cnt: opt.otherUseStockRecordCnt,
          query: { type: 'otherUse' }
        }
      ]).setRemark(`${opt.remark}·校验条数`))
    }
    if (opt.instock != null) {
      let instock = opt.instock
      actions.push(new CheckArray([{
        table: 'otherUse',
        query: {
          otherUseId: '${otherInstockId}',
          warehouseId: '${warehouse.warehouseId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, `${opt.name}:其他入库单据不存在`)
          CheckUtil.expectEqual(Number(array[0].isAdd), 1, `${opt.name}:isAdd应为1`)
          CheckUtil.expectEqual(Number(array[0].cost), instock.otherUseCost, `${opt.name}:单据金额与单价不一致`)
        }
      }, {
        table: 'otherItem',
        query: {
          otherUseId: '${otherInstockId}',
          warehouseId: '${warehouse.warehouseId}',
          isDel: 0
        },
        check(array) {
          for (let line of instock.lines) {
            let materialId = variable.materialMap?.[line.name]?.materialId
            let row = array.find((item: any) => String(item.materialId) === String(materialId))
            CheckUtil.expectEqual(row != null, true, `${opt.name}:${line.name}明细不存在`)
            CheckUtil.expectEqual(StockUtil.isEq(
              { cnt: Number(row.cnt), buyUnitFee: Number(row.buyUnitFee) },
              { cnt: line.cnt, buyUnitFee: line.buyUnitFee }
            ), true, `${opt.name}:${line.name}数量不对`)
            CheckUtil.expectEqual(StockUtil.isEqPrice(
              { price: Number(row.price), buyUnitFee: Number(row.stockBuyUnitFee) },
              { price: line.price, buyUnitFee: line.stockBuyUnitFee }
            ), true, `${opt.name}:${line.name}单价不对`)
          }
        }
      }, {
        table: 'stockRecord',
        query: {
          type: 'otherInstock',
          warehouseId: '${warehouse.warehouseId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, instock.lines.length, `${opt.name}:其他入库流水条数不对`)
          for (let line of instock.lines) {
            let materialId = variable.materialMap?.[line.name]?.materialId
            let row = array.find((item: any) => String(item.materialId) === String(materialId))
            CheckUtil.expectEqual(row != null, true, `${opt.name}:${line.name}流水不存在`)
            CheckUtil.expectEqual(StockUtil.isEq(
              { cnt: Number(row.cnt), buyUnitFee: Number(row.buyUnitFee) },
              { cnt: line.cnt, buyUnitFee: line.buyUnitFee }
            ), true, `${opt.name}:${line.name}流水数量不对`)
            CheckUtil.expectEqual(Number(row.cost), line.cost, `${opt.name}:${line.name}流水金额与单价不一致`)
            CheckUtil.expectEqual(row.calType, 'add', `${opt.name}:${line.name}流水方向应为入库`)
          }
        }
      }]).setRemark(`${opt.remark}·校验其他入库单价`))
    }
    return [
      new VerifyStep({
        remark: opt.remark,
        name: opt.name,
        actions
      })
    ]
  }
}

/**
 * 7月1日订单：createNote → sendNote → processNote 入库，再 updateNoteTime 改为 2026-07-01。
 * 单价 2元/g：牛肉按包价 200元/包；羊/猪 price=2、stockBuyUnitFee=1。
 */
class OrderInstockJuly1 extends TestCase {
  constructor() {
    super({ remark: '7月1日订单入库：牛肉3包、羊肉4包、猪肉500g，单价2元/g' })
  }

  getName(): string {
    return '7月1日订单入库'
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
              cnt: 3,
              buyUnitFee: 1,
              price: 200,
              stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.羊肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 4,
              buyUnitFee: -100,
              price: 2,
              stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.猪肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 500,
              buyUnitFee: 1,
              price: 2,
              stockBuyUnitFee: 1
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
      }),

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
        name: '修改订单时间为7月1日',
        remark: 'updateNoteTime：同步改 note.createTime 与入库流水业务日并重算',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${note.noteId}',
          sysAddTime: '2026-07-01 00:00:00',
          lastUpdateTime: '2026-07-01 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ]
  }
}

/** 查询报损类型 + 7月2日新增消耗 */
class AddOtherUseJuly2 extends TestCase {
  constructor() {
    super({ remark: '新增7月2日消耗：牛肉1包、羊肉1包（报损）' })
  }

  getName(): string {
    return '新增7月2日消耗'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '查询消耗类型',
        remark: '拉取 OtherType，拿到报损 id',
        url: '/app/otherType/listOtherType',
        param: {
          isAdd: 0
        }
      }, {
        buildVariable(result) {
          let content = result.result.content ?? []
          return {
            otherTypeMap: ArrayUtil.toMapByKey(content, 'name', 'otherTypeId')
          }
        }
      }),
      new Action({
        name: '保存其他消耗(7月2日)',
        remark: '报损：牛肉1包 + 羊肉1包',
        url: '/app/otherUse/saveOtherUse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherTypeMap.报损}',
          isAdd: 0,
          remark: '7月2日消耗',
          createTime: '2026-07-02',
          otherItems: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 1,
              buyUnitFee: 1
            },
            {
              materialId: '${materialMap.羊肉.materialId}',
              cnt: 1,
              buyUnitFee: -100
            }
          ]
        }
      }, {
        buildVariable(result) {
          return {
            otherUseId: result.result.otherUseId
          }
        }
      })
    ]
  }
}

/** 查询赠予类型 + 7月3日其他入库。牛肉50元/包，猪肉3元/g，西瓜10元/个。 */
class AddOtherInstockJuly3 extends TestCase {
  constructor() {
    super({ remark: '新增7月3日其他入库：牛肉2包50元/包、猪肉100g 3元/g、西瓜5个10元/个（赠予）' })
  }

  getName(): string {
    return '新增7月3日其他入库'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '查询入库类型',
        remark: '拉取 isAdd=1 的 OtherType，拿到赠予 id',
        url: '/app/otherType/listOtherType',
        param: {
          isAdd: 1
        }
      }, {
        buildVariable(result) {
          let content = result.result.content ?? []
          let gift = content.find((row: any) => row.name == '赠予')
          return {
            otherInstockTypeId: gift?.otherTypeId
          }
        }
      }),
      new Action({
        name: '保存其他入库(7月3日)',
        remark: '赠予：牛肉2包×50元，猪肉100g×3元，西瓜5个×10元',
        url: '/app/otherUse/saveOtherUse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherInstockTypeId}',
          isAdd: 1,
          remark: '7月3日其他入库',
          createTime: '2026-07-03',
          otherItems: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 2,
              buyUnitFee: 1,
              price: 50,
              stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.猪肉.materialId}',
              cnt: 100,
              buyUnitFee: 1,
              price: 3,
              stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.西瓜.materialId}',
              cnt: 5,
              buyUnitFee: 1,
              price: 10,
              stockBuyUnitFee: 1
            }
          ]
        }
      }, {
        buildVariable(result) {
          return {
            otherInstockId: result.result.otherUseId
          }
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

import path from "path";
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
import Upload from "../../action/Upload";
import ExcelUploadUtil from "../../util/ExcelUploadUtil";

/**
 * 其他耗用、其他入库和导入（见同目录 FlowOtherUse.md）。
 *
 * 物料规格见 PreTestWithMeat：
 * - 羊肉：标准单位=克；按包用 buyUnitFee=-100
 * - 牛肉：标准单位=包；按包用 buyUnitFee=1
 * - 猪肉：标准单位=克；buyUnitFee=1
 * - 西瓜：标准单位=个；buyUnitFee=1，其他入库单价 10 元/个
 *
 * 库存时间轴：
 * - 5/1、6/1 盘点（绝对库存，1元/g）
 * - 7/1 createNote→发送→入库（累加，2元/g），再 updateNoteTime 改业务日
 * - 之后 OtherUse 增删改与改日期（isAdd=0）
 * - 删除后再做其他入库（isAdd=1，赠予）：含西瓜 5 个，再改为 8 个并删除猪肉
 * - 最后导入写入已有单据：不校验日期和类型，已有明细保留，相同物料数量累加
 *
 * md「牛肉改为1包50g」按 1包+50g=150g=1.5包；「周肉」按猪肉。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '其他耗用：盘点、消耗、其他入库，再导入到已有单据并校验库存和金额' })
  }

  getName(): string {
    return '其他耗用'
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
      new AddMaterial('空价菜', {
        buyUnit: [{ name: '斤', fee: 1 }],
        categoryId: '${categoryMap.蔬菜}',
        code: 'MAT005',
        suppliers: []
      }),
      new ListMaterial(),
      this.buildGetMaterialPrice(),

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
      }, variable),

      new ImportOtherUse()
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

  /** 默认供应商价。空价菜和没有的 id 不返回。 */
  private buildGetMaterialPrice(): Action {
    return new Action({
      name: 'getMaterialPrice',
      remark: '牛肉、猪肉返回 price 和 buyUnitFee；空价菜不返回',
      url: '/app/material/getMaterialPrice',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        materialIds: [
          '${materialMap.牛肉.materialId}',
          '${materialMap.空价菜.materialId}',
          999999001,
          '${materialMap.猪肉.materialId}'
        ]
      }
    }, {
      check: (result) => {
        let list: any[] = result.result ?? []
        CheckUtil.expectEqual(Array.isArray(list), true, 'getMaterialPrice 应返回数组')
        CheckUtil.expectEqual(list.length, 2, `应返回2条，实际=${list.length}`)
        this.expectMaterialPrice(list[0], '牛肉', 21, 1)
        this.expectMaterialPrice(list[1], '猪肉', 21, 1)
      }
    })
  }

  private expectMaterialPrice(row: any, name: string, price: number, buyUnitFee: number) {
    let materialId = this.getVariable().materialMap?.[name]?.materialId
    CheckUtil.expectEqual(String(row?.materialId), String(materialId), `应返回${name}`)
    CheckUtil.expectEqual(row?.stockUnitsId != null, true, `${name}应返回 stockUnitsId`)
    CheckUtil.expectEqual(StockUtil.isEqPrice(
      { price: Number(row.price), buyUnitFee: Number(row.buyUnitFee) },
      { price, buyUnitFee }
    ), true, `${name}价格不对，实际 price=${row?.price} buyUnitFee=${row?.buyUnitFee}`)
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

/**
 * 导入写入已有单据。日期和类型不再校验。
 * 已有明细保留，相同物料数量累加；其他入库按金额反算单价。
 */
class ImportOtherUse extends TestCase {
  constructor() {
    super({ remark: '导入到已有单据：其他入库、其他耗用，失败不改明细' })
  }

  getName(): string {
    return '导入到已有单据'
  }

  protected getFile(name: string): string {
    if (!name.endsWith('.xlsx')) {
      name += '.xlsx'
    }
    return path.join(__dirname, '../../../excel/flowOtherUse/', name)
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '新增类型天上掉的',
        remark: '其他入库类型 isAdd=1',
        url: '/app/otherType/addOtherType',
        param: {
          name: '天上掉的',
          isAdd: 1
        }
      }),
      new Action({
        name: '取出天上掉的',
        remark: '记下天上掉的类型 id',
        url: '/app/otherType/listOtherType',
        param: {
          isAdd: 1
        }
      }, {
        buildVariable(result) {
          let content = result.result?.content ?? []
          let row = content.find((item: any) => item.name == '天上掉的')
          CheckUtil.expectEqual(row != null, true, '未找到天上掉的')
          return {
            skyTypeId: row.otherTypeId
          }
        }
      }),

      this.buildCreateUse({
        name: '新增天上掉的',
        remark: '2026-07-20 天上掉的，先有西瓜2个',
        day: '2026-07-20',
        isAdd: 1,
        typeExpr: '${skyTypeId}',
        idKey: 'skyUseId',
        otherItems: [{
          materialId: '${materialMap.西瓜.materialId}',
          cnt: 2,
          buyUnitFee: 1,
          price: 10,
          stockBuyUnitFee: 1
        }]
      }),
      ...this.buildFailUpload(
        '导入其他入库（错误）',
        'OtherInstock',
        '其他入库错误',
        'instockErrorNo',
        'skyUseId'
      ),
      this.buildQueryItems('错误导入未改天上掉的', 'skyUseId', (rows) => {
        CheckUtil.expectEqual(rows.length, 1, `天上掉的应仍是1条明细，实际=${rows.length}`)
        this.checkLine(rows, '西瓜', { cnt: 2, buyUnitFee: 1 }, { price: 10, buyUnitFee: 1 }, '错误导入后西瓜')
      }),

      ...this.buildUpload(
        '导入天上掉的猪肉',
        'OtherInstock',
        '其他入库天上掉的',
        'skyUseId',
        (importResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '天上掉的应导入成功')
        }
      ),
      this.buildQueryUse('校验天上掉的', 'skyUseId', (doc, rows) => {
        CheckUtil.expectEqual(Number(doc.cost), 220, `天上掉的金额应为220，实际=${doc.cost}`)
        CheckUtil.expectEqual(rows.length, 2, `天上掉的应有2条明细，实际=${rows.length}`)
        this.checkLine(rows, '西瓜', { cnt: 2, buyUnitFee: 1 }, { price: 10, buyUnitFee: 1 }, '天上掉的西瓜')
        this.checkLine(rows, '猪肉', { cnt: 100, buyUnitFee: 1 }, { price: 2, buyUnitFee: 1 }, '天上掉的猪肉')
      }),

      this.buildCreateUse({
        name: '新增7月21日赠予',
        remark: '2026-07-21 赠予，先有西瓜1个',
        day: '2026-07-21',
        isAdd: 1,
        typeExpr: '${otherInstockTypeId}',
        idKey: 'giftUseId',
        otherItems: [{
          materialId: '${materialMap.西瓜.materialId}',
          cnt: 1,
          buyUnitFee: 1,
          price: 10,
          stockBuyUnitFee: 1
        }]
      }),
      ...this.buildUpload(
        '导入赠予西瓜',
        'OtherInstock',
        '其他入库赠予',
        'giftUseId',
        (importResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '赠予应导入成功')
        }
      ),
      this.buildQueryUse('校验赠予合并', 'giftUseId', (doc, rows) => {
        CheckUtil.expectEqual(Number(doc.cost), 30, `赠予金额应为30，实际=${doc.cost}`)
        CheckUtil.expectEqual(rows.length, 1, `赠予应仍是1条明细，实际=${rows.length}`)
        this.checkLine(rows, '西瓜', { cnt: 2, buyUnitFee: 1 }, { price: 30, buyUnitFee: -2 }, '赠予西瓜')
      }),

      this.buildCreateUse({
        name: '新增7月22日员工餐',
        remark: '空的其他耗用，等导入写入',
        day: '2026-07-22',
        isAdd: 0,
        typeExpr: '${otherTypeMap.员工餐}',
        idKey: 'mealUseId'
      }),
      ...this.buildFailUpload(
        '导入其他耗用（错误）',
        'OtherUse',
        '其他消耗错误',
        'useErrorNo',
        'mealUseId'
      ),
      this.buildQueryItems('错误导入未写入员工餐', 'mealUseId', (rows) => {
        CheckUtil.expectEqual(rows.length, 0, `员工餐应仍无明细，实际=${rows.length}`)
      }),
      ...this.buildUpload(
        '导入员工餐',
        'OtherUse',
        '其他消耗员工餐',
        'mealUseId',
        (importResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '员工餐应导入成功')
        }
      ),
      this.buildQueryUse('校验员工餐', 'mealUseId', (doc, rows) => {
        CheckUtil.expectEqual(Number(doc.cost), 0, `员工餐金额应为0，实际=${doc.cost}`)
        CheckUtil.expectEqual(rows.length, 1, `员工餐应合并成1条明细，实际=${rows.length}`)
        this.checkLine(rows, '西瓜', { cnt: 2, buyUnitFee: 1 }, null, '员工餐西瓜')
      }),

      new Recal().setRemark('导入后重算库存'),
      new CheckStock({
        array: [
          { materialId: '${materialMap.牛肉.materialId}', cnt: 7, buyUnitFee: 1 },
          { materialId: '${materialMap.羊肉.materialId}', cnt: 7, buyUnitFee: -100 },
          { materialId: '${materialMap.猪肉.materialId}', cnt: 1000, buyUnitFee: 1 },
          { materialId: '${materialMap.西瓜.materialId}', cnt: 10, buyUnitFee: 1 }
        ]
      }).setRemark('牛7包、羊7包、猪1000g、西瓜10个'),
      new CheckCnt([
        { table: 'otherUse', cnt: 4 },
        { table: 'otherItem', cnt: 6 },
        { table: 'stockRecord', cnt: 1, query: { type: 'otherUse' } }
      ]).setRemark('4条单据、6条明细、1条其他耗用流水'),
      new Action({
        name: '校验导入后库存金额',
        remark: '牛900、羊1100、猪1600、西瓜110',
        url: '/free/query',
        param: {
          array: [{
            table: 'stock',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }, {
            table: 'otherUse',
            query: {
              otherUseId: '${otherInstockId}',
              warehouseId: '${warehouse.warehouseId}',
              isDel: 0
            }
          }]
        }
      }, {
        check: (result) => {
          let stocks: any[] = result.result?.stock ?? []
          let costs = [
            { name: '牛肉', cost: 900 },
            { name: '羊肉', cost: 1100 },
            { name: '猪肉', cost: 1600 },
            { name: '西瓜', cost: 110 }
          ]
          for (let expect of costs) {
            let stock = this.findByMaterial(stocks, expect.name)
            CheckUtil.expectEqual(stock != null, true, `${expect.name}库存不存在`)
            CheckUtil.expectEqual(Number(stock.cost), expect.cost, `${expect.name}库存金额应为${expect.cost}，实际=${stock.cost}`)
          }
          let july3: any[] = result.result?.otherUse ?? []
          CheckUtil.expectEqual(july3.length, 1, '7月3日其他入库应还在')
          CheckUtil.expectEqual(Number(july3[0].cost), 180, `7月3日单据金额应为180，实际=${july3[0].cost}`)
        }
      })
    ]
  }

  private buildCreateUse(opt: {
    name: string
    remark: string
    day: string
    isAdd: number
    typeExpr: string
    idKey: string
    otherItems?: any[]
  }): Action {
    return new Action({
      name: opt.name,
      remark: opt.remark,
      url: '/app/otherUse/saveOtherUse',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        openTypeId: opt.typeExpr,
        isAdd: opt.isAdd,
        createTime: opt.day,
        remark: opt.remark,
        otherItems: opt.otherItems ?? []
      }
    }, {
      buildVariable(result) {
        let otherUseId = result.result?.otherUseId
        CheckUtil.expectEqual(otherUseId != null, true, `${opt.name} 未返回 otherUseId`)
        return {
          [opt.idKey]: otherUseId
        }
      }
    })
  }

  private buildQueryItems(name: string, idKey: string, checkRows: (rows: any[]) => void): Action {
    return new Action({
      name,
      remark: name,
      url: '/free/query',
      param: {
        array: [{
          table: 'otherItem',
          query: {
            otherUseId: `\${${idKey}}`,
            warehouseId: '${warehouse.warehouseId}',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            isDel: 0
          }
        }]
      }
    }, {
      check: (result) => {
        checkRows(result.result?.otherItem ?? [])
      }
    })
  }

  private buildQueryUse(
    name: string,
    idKey: string,
    checkDoc: (doc: any, rows: any[]) => void
  ): Action {
    return new Action({
      name,
      remark: name,
      url: '/free/query',
      param: {
        array: [{
          table: 'otherUse',
          query: {
            otherUseId: `\${${idKey}}`,
            warehouseId: '${warehouse.warehouseId}',
            isDel: 0
          }
        }, {
          table: 'otherItem',
          query: {
            otherUseId: `\${${idKey}}`,
            warehouseId: '${warehouse.warehouseId}',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            isDel: 0
          }
        }]
      }
    }, {
      check: (result) => {
        let docs: any[] = result.result?.otherUse ?? []
        CheckUtil.expectEqual(docs.length, 1, `${name} 单据不存在`)
        checkDoc(docs[0], result.result?.otherItem ?? [])
      }
    })
  }

  /**
   * 列未全部匹配时走 saveExcel。
   * otherUseId 随上传参数写入 excelFile.param。
   */
  private buildUpload(
    name: string,
    target: string,
    fileName: string,
    otherUseIdKey: string,
    checkImport?: (importResult: any) => void,
    buildImportVariable?: (importResult: any, topResult?: any) => any
  ): BaseTest[] {
    return [
      new Upload({
        name,
        remark: name,
        param: {
          target,
          warehouseId: '${warehouse.warehouseId}',
          otherUseId: `\${${otherUseIdKey}}`
        },
        filePath: this.getFile(fileName)
      }, {
        buildVariable(result) {
          let data = result.result ?? {}
          let importResult = data.allMap ? (data.importResult ?? {}) : {}
          let extra = buildImportVariable ? (buildImportVariable(importResult, data) ?? {}) : {}
          return {
            excelFileId: data.excelFileId,
            fileCols: ExcelUploadUtil.buildSaveFileCols(data.fileCols),
            allMap: !!data.allMap,
            ...extra
          }
        },
        check(result) {
          let data = result.result
          if (data?.allMap && checkImport) {
            checkImport(data.importResult)
          }
        }
      }),
      new Action({
        name: `saveExcel[${name}]`,
        remark: '列未全部自动匹配时再保存导入',
        url: '/app/excel/saveExcel',
        param: {
          excelFileId: '${excelFileId}',
          fileCols: '${fileCols}',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        needRunVariable: {
          key: 'allMap',
          not: true
        },
        buildVariable(result) {
          if (!buildImportVariable) {
            return {}
          }
          let data = result.result ?? {}
          return buildImportVariable(data, data) ?? {}
        },
        check(result) {
          if (checkImport) {
            checkImport(result.result)
          }
        }
      })
    ]
  }

  private buildFailUpload(
    name: string,
    target: string,
    fileName: string,
    errorNoKey: string,
    otherUseIdKey: string
  ): BaseTest[] {
    return [
      ...this.buildUpload(
        name,
        target,
        fileName,
        otherUseIdKey,
        (importResult) => {
          CheckUtil.expectEqual(importResult?.checked, false, `${name} 应失败`)
        },
        (importResult, topResult) => {
          let errorNo = importResult?.errorNo ?? topResult?.importResult?.errorNo ?? topResult?.errorNo
          return {
            [errorNoKey]: errorNo
          }
        }
      ),
      new Action({
        name: `查询导入错误[${name}]`,
        remark: '只应出现物料不存在，日期和类型不再报错',
        url: '/free/query',
        param: {
          array: [{
            table: 'excelError',
            query: {
              errorNo: `\${${errorNoKey}}`,
              isDel: 0
            }
          }]
        }
      }, {
        check(result) {
          let array: any[] = result.result?.excelError ?? []
          let msgs = array.map(row => String(row.errorMsg ?? '')).join(';')
          let parts = msgs.split(';').map(text => text.trim().replace(/。/g, '')).filter(text => text !== '')
          CheckUtil.expectEqual(parts.includes('物料不存在'), true, `${name} 应有物料不存在，实际=${msgs}`)
          CheckUtil.expectEqual(parts.includes('类型不存在'), false, `${name} 不应再报类型不存在，实际=${msgs}`)
          CheckUtil.expectEqual(parts.includes('日期不能为空'), false, `${name} 不应再报日期，实际=${msgs}`)
          let extra = parts.filter(text => text !== '物料不存在')
          CheckUtil.expectEqual(extra.length, 0, `${name} 出现了其他错误，实际=${msgs}`)
        }
      })
    ]
  }

  private checkLine(
    rows: any[],
    name: string,
    qty: { cnt: number, buyUnitFee: number },
    price: { price: number, buyUnitFee: number } | null,
    label: string
  ) {
    let row = this.findByMaterial(rows, name)
    CheckUtil.expectEqual(row != null, true, `${label}不存在`)
    CheckUtil.expectEqual(StockUtil.isEq(
      { cnt: Number(row.cnt), buyUnitFee: Number(row.buyUnitFee) },
      qty
    ), true, `${label}数量不对，实际 cnt=${row.cnt} buyUnitFee=${row.buyUnitFee}`)
    if (price == null) {
      CheckUtil.expectEqual(row.price == null || row.price === '', true, `${label}不应写价格，实际=${row.price}`)
      return
    }
    CheckUtil.expectEqual(StockUtil.isEqPrice(
      { price: Number(row.price), buyUnitFee: Number(row.stockBuyUnitFee) },
      price
    ), true, `${label}单价不对，实际 price=${row.price} stockBuyUnitFee=${row.stockBuyUnitFee}`)
  }

  private findByMaterial(rows: any[], name: string): any {
    let materialId = this.getVariable().materialMap?.[name]?.materialId
    return rows.find(row => String(row.materialId) === String(materialId))
  }
}

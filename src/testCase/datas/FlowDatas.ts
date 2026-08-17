import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";
import ListMaterial from "../../action/material/ListMaterial";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import QueryAction from "../../action/QueryAction";
import UpdateCntAndPrice from "../../action/note/UpdateCntAndPrice";
import Upload from "../../action/Upload";
import path from "path";

/**
 * 牛肉完整周期：6/30 按包盘点，再改规格 1包=100g，随后按克进货、按包销售、订单入库、退货、7/31 再盘点，
 * 最后 updatePrice 改 7/4 入库量价，改价前后各打一次 analysyMaterial。
 * 详见同目录 FlowDatas.md。
 *
 * FIFO（标准单位=包；克用 buyUnitFee=100）：
 * - 6/30 盘点 0.5包/50元（改规格前，fee=1）→ 50g @1元/g
 * - 7/2 手工入库 500g(fee100)/1000元 → 合计 5.5包 / 1050元
 * - 7/3 销售 3包（红烧2+水煮1）：先扣盘点 0.5包/50，再扣进货 2.5包/500 → 余 2.5包 / 500
 * - 7/4 正常入库 2包(fee1)/600元（300元/包）→ 4.5包 / 1100
 * - 7/5 退货 1包：FIFO 扣 7/2 批次 200元 → 3.5包 / 900
 * - 7/31 盘点 1包：processSet 按最新批次 300元/包回填 → 1包 / 300
 * - updatePrice：7/4 改为 3包/1200（400元/包），重算 7/4 之后流水
 *   退货仍扣 7/2 的 1包/200 → 盘点前 4.5包/1500；7/31 按最新批次 400元/包回填 → 1包 / 400
 *
 * analysyMaterial（begin=7/01，end=7/31）只读 sales+inventory 的 costOfChange*-1：
 * 6/30 盘点流水在区间外，但销售 FIFO 仍扣该批次 0.5包/50。
 * 改价前：销售 0.5包/50+2.5包/500=550，7/31 盘亏 2.5包/600；allStock=5.5包/1150
 * BOM 100元/包：theoryCost=300；costByBomPrice=550；diffByCnt=250；diffByPrice=600；diff=850
 * 改价后：销售仍 550，7/31 盘亏 3.5包/1100；allStock=6.5包/1650
 * theoryCost=300；costByBomPrice=650；diffByCnt=350；diffByPrice=1000；diff=1350
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '完整周期：6/30盘点→改规格→手工入库→销售→订单入库→退货→7/31盘点→改价改量' })
  }

  getName(): string {
    return '完整周期的变化'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new PreTest({
        remark: '前置：仓库/供应商；牛肉初始单位「包」',
        materialsOpts: [
          { name: '牛肉', category: '肉类', unit: '包', code: 'MAT_BEEF' }
        ]
      }),

      new Action({
        name: '6月30日盘点0.5包',
        remark: '改规格前按包盘点：cnt=0.5, buyUnitFee=1, cost=50',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-06-30',
          array: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 0.5,
            buyUnitFee: 1,
            cost: 50
          }]
        }
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
      new ListMaterial().setRemark('刷新 materialMap'),

      new SetupProductBom(),

      new Action({
        name: '7月2日进货500g',
        remark: '手工入库：cnt=500, buyUnitFee=100, cost=1000（2元/g）',
        url: '/app/note/createHandInstock',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          salesDay: '2026-07-02',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 500,
            buyUnitFee: 100,
            cost: 1000,
            price: 2,
            stockBuyUnitFee: 100
          }]
        }
      }),

      new UploadSalesJuly3(),

      new OrderInstockJuly4(),

      new BackJuly5(),

      ...this.buildVerifyStock({
        remark: '期末盘点前校验：3.5包/900元（FIFO 扣7/2批次1包/200）',
        name: '校验7月31日盘点前库存',
        cnt: 3.5,
        buyUnitFee: 1,
        cost: 900
      }, variable),

      new Action({
        name: '7月31日盘点1包',
        remark: '期末盘点 1包（buyUnitFee=1）；processSet 忽略输入成本，按最新批次回填',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-07-31',
          array: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 1,
            buyUnitFee: 1,
            cost: 300
          }]
        }
      }),

      new Recal().setRemark('改价前物料分析重算'),

      this.buildAnalysyMaterial({
        name: '改价前analysyMaterial',
        remark: '改价前：期初批次50 + 7/2消耗4包/800 + 7/4盘亏1包/300 = 1150；销量3包 theoryCost=300',
        cost: 1150,
        theoryCost: 300,
        diff: 850,
        diffByCnt: 250,
        diffByPrice: 600,
        saveAs: 'firstAnalysy'
      }, variable),

      new UpdatePriceJuly4(),

      new Recal().setRemark('改价后物料分析重算'),

      this.buildAnalysyMaterial({
        name: '改价后analysyMaterial',
        remark: '改价后：销售仍550，7/31盘亏3.5包/1100，合计1650',
        cost: 1650,
        theoryCost: 300,
        diff: 1350,
        diffByCnt: 350,
        diffByPrice: 1000,
        compareWith: 'firstAnalysy'
      }, variable),
    ]
  }

  private buildAnalysyMaterial(opt: {
    name: string
    remark: string
    cost: number
    theoryCost: number
    diff: number
    diffByCnt: number
    diffByPrice: number
    saveAs?: string
    compareWith?: string
  }, variable: any): Action {
    return new Action({
      name: opt.name,
      remark: opt.remark,
      url: '/app/state/analysyMaterial',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: '2026-07-01',
        end: '2026-07-31'
      }
    }, {
      check(result) {
        let content = result.result?.content ?? []
        let beefId = variable.materialMap?.牛肉?.materialId
        let row = content.find((r: any) => String(r.materialId) === String(beefId))
        CheckUtil.expectEqual(row != null, true, `${opt.name}应有牛肉行`)
        CheckUtil.expectEqual(!!row.hasBeginInventory, false, `7/01无盘点，不应有期初盘点，实际=${row.hasBeginInventory}`)
        CheckUtil.expectEqual(!!row.hasEndInventory, true, `应有期末盘点，实际=${row.hasEndInventory}`)
        CheckUtil.expectEqual(!!row.hasMidInventory, false, `期中不应有盘点，实际=${row.hasMidInventory}`)
        CheckUtil.expectEqual(Number(row.cost), opt.cost, `实际成本(分摊后)应为${opt.cost}，实际=${row.cost}；cnt=${JSON.stringify(row.cnt)}，theoryCnt=${JSON.stringify(row.theoryCnt)}，theoryCost=${row.theoryCost}，diff=${row.diff}`)
        CheckUtil.expectEqual(Number(row.theoryCost), opt.theoryCost, `理论成本应为${opt.theoryCost}，实际=${row.theoryCost}`)
        CheckUtil.expectEqual(Number(row.diff), opt.diff, `diff应为${opt.diff}，实际=${row.diff}`)
        CheckUtil.expectEqual(Number(row.diffByCnt), opt.diffByCnt, `diffByCnt应为${opt.diffByCnt}，实际=${row.diffByCnt}`)
        CheckUtil.expectEqual(Number(row.diffByPrice), opt.diffByPrice, `diffByPrice应为${opt.diffByPrice}，实际=${row.diffByPrice}`)
        if (opt.compareWith) {
          let first = variable[opt.compareWith]
          CheckUtil.expectEqual(first != null, true, `应记下${opt.compareWith}`)
          CheckUtil.expectEqual(first.theoryCost, row.theoryCost, '两次theoryCost应相同（销量未变）')
          CheckUtil.expectEqual(first.cost !== row.cost, true, '两次cost应不同（入库量价已变）')
        }
      },
      buildVariable(result) {
        if (!opt.saveAs) {
          return {}
        }
        let content = result.result?.content ?? []
        let beefId = variable.materialMap?.牛肉?.materialId
        return {
          [opt.saveAs]: content.find((r: any) => String(r.materialId) === String(beefId))
        }
      }
    })
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

/** 红烧牛肉、水煮牛肉：BOM 每份各 1包(fee1)，理论价 100元/包（1元/g） */
class SetupProductBom extends TestCase {
  constructor() {
    super({ remark: '增加红烧牛肉、水煮牛肉并设置BOM：各1包/份(buyUnitFee=1)，理论价100元/包' })
  }

  getName(): string {
    return '设置餐品BOM'
  }

  private buildProduct(productName: string): BaseTest[] {
    return [
      new Action({
        name: `增加餐品${productName}`,
        remark: 'addProduct',
        url: '/app/product/addProduct',
        param: { name: productName }
      }, {
        buildVariable(result) {
          return { productId: result.result.productId }
        }
      }),
      new Action({
        name: `保存BOM:${productName}`,
        remark: '每份消耗牛肉1包(fee1)，price=100元/包',
        url: '/app/bom/saveBom',
        param: {
          productId: '${productId}',
          boms: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 1,
            buyUnitFee: 1,
            yieldRate: 1,
            netCnt: 1,
            price: 100,
            stockBuyUnitFee: 1
          }]
        }
      })
    ]
  }

  protected buildActions(): BaseTest[] {
    return [
      ...this.buildProduct('红烧牛肉'),
      ...this.buildProduct('水煮牛肉'),
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

/** 7月4日正常入库：createNote → sendNote → processNote，再 updateNoteTime 到 7/4 */
class OrderInstockJuly4 extends TestCase {
  constructor() {
    super({ remark: '7月4日订单入库：牛肉2包(buyUnitFee=1)/600元（300元/包）' })
  }

  getName(): string {
    return '7月4日正常入库2包'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote(牛2包)',
        remark: '下单牛肉2包(fee1)，600元，300元/包',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 2,
            buyUnitFee: 1,
            price: 300,
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
      }).setRemark('待入库分组'),
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
        name: '修改订单时间为7月4日',
        remark: 'updateNoteTime → 2026-07-04',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${note.noteId}',
          sysAddTime: '2026-07-04 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ]
  }
}

/** 改 7/4 订单入库：2包/300元 → 3包/400元，触发 7/4 之后流水重算 */
class UpdatePriceJuly4 extends TestCase {
  constructor() {
    super({ remark: 'updatePrice：7/4入库 2包/300元 → 3包/400元' })
  }

  getName(): string {
    return '改7月4日入库数量和价格'
  }

  protected buildActions(): BaseTest[] {
    return [
      new QueryAction({
        name: '查询7/4订单物料',
        url: '/app/noteItem/listNoteItem',
        query: { noteId: '${note.noteId}' }
      }, {
        buildVariable(result) {
          return { noteItems: result.result.content }
        }
      }).setRemark('记下 noteItems，供 updatePrice 使用'),
      new UpdateCntAndPrice({
        name: '改牛肉入库为3包/400元',
        changes: [{
          name: '牛肉',
          price: 400,
          stockBuyUnitFee: 1,
          instockCnt: 3
        }]
      }).setRemark('updatePrice：instockCnt=3, price=400, stockBuyUnitFee=1')
    ]
  }
}

/** 7月5日从7/4订单退货1包（fee1），金额按 FIFO 最旧批次 */
class BackJuly5 extends TestCase {
  constructor() {
    super({ remark: '7月5日退货牛肉1包(buyUnitFee=1)，金额按FIFO' })
  }

  getName(): string {
    return '7月5日退货1包'
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
      }).setRemark('取退货单 noteId'),
      new Action({
        name: '修改退货单时间为7月5日',
        remark: 'updateNoteTime → 2026-07-05',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${backNoteId}',
          sysAddTime: '2026-07-05 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ]
  }
}

/** 7月3日销售：上传 excel（营业日期字符串 2026/07/03）再 saveExcel */
class UploadSalesJuly3 extends TestCase {
  constructor() {
    super({ remark: '红烧牛肉2份+水煮牛肉1份 → 牛肉-3包（BOM 各1包/份）' })
  }

  getName(): string {
    return '7月3日销售3包'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Upload({
        name: '上传销售记录',
        remark: 'uploadExcel：红烧牛肉2份+水煮牛肉1份，营业日期2026/07/03',
        param: {
          target: 'salesRecord',
          warehouseId: '${warehouse.warehouseId}'
        },
        filePath: path.join(__dirname, '../../../excel/datas/sales0703.xlsx')
      }, {
        buildVariable(result) {
          result = result.result
          let fileCols = (result.fileCols ?? []).filter((row: any) => row.targetCol != null)
          fileCols = fileCols.map((row: any) => ({
            targetCol: row.targetCol,
            excelFileId: row.excelFileId
          }))
          return {
            excelFileId: result.excelFileId,
            fileCols
          }
        }
      }),
      new Action({
        name: 'saveExcel',
        remark: '保存销售导入',
        url: '/app/excel/saveExcel',
        param: {
          excelFileId: '${excelFileId}',
          fileCols: '${fileCols}',
          warehouseId: '${warehouse.warehouseId}'
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

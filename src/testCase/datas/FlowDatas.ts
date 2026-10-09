import { ArrayUtil, BaseTest, CheckUtil, DownloadExcelAction, MultiSheetDownloadAction, TestCase } from "testflow";
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

function expectCols(row: any, expect: Record<string, any>, label: string) {
  CheckUtil.expectEqual(row != null, true, `${label}缺少行`)
  for (let col in expect) {
    CheckUtil.expectEqual(row[col], expect[col], `${label}.${col}，期望${expect[col]}，实际${row?.[col]}`)
  }
}

function readVar(variable: any, path: string): any {
  let cur = variable
  for (let key of path.split('.')) {
    cur = cur?.[key]
  }
  return cur
}

/** 取日期字符串的 yyyy-MM-dd */
function dayOf(value: any): string {
  if (value == null) {
    return ''
  }
  return String(value).substring(0, 10)
}

/** 断言 noteItem 入库操作人与时间 */
function checkInstockOp(rows: any[], usersId: any, expectDay: string | null, label: string) {
  CheckUtil.expectEqual(rows.length > 0, true, `${label}应有明细`)
  for (let row of rows) {
    CheckUtil.expectEqual(
      Number(row.instockUser),
      Number(usersId),
      `${label} noteItemId=${row.noteItemId} instockUser 应为${usersId}，实际=${row.instockUser}`
    )
    CheckUtil.expectEqual(
      row.instockTime != null,
      true,
      `${label} noteItemId=${row.noteItemId} instockTime 不应为空`
    )
    if (expectDay != null) {
      CheckUtil.expectEqual(
        dayOf(row.instockTime),
        expectDay,
        `${label} noteItemId=${row.noteItemId} instockTime 应为${expectDay}，实际=${row.instockTime}`
      )
    }
  }
}

/**
 * 牛肉完整周期：6/30 按包盘点，再改规格 1包=100g，随后按克进货、按包销售、订单入库、退货、7/6报损、7/31 再盘点，
 * 最后 updatePrice 改 7/4 入库量价，改价前后各打一次 analysyMaterial，再下载报表（不含结算单）。
 * 详见同目录 FlowDatas.md。
 *
 * FIFO（标准单位=包；克用 buyUnitFee=100）：
 * - 6/30 盘点 0.5包/50元（改规格前，fee=1）→ 50g @1元/g
 * - 7/2 手工入库 500g(fee100)/1000元 → 合计 5.5包 / 1050元
 * - 7/3 销售 3包（红烧2+水煮1）：先扣盘点 0.5包/50，再扣进货 2.5包/500 → 余 2.5包 / 500
 * - 7/4 正常入库 2包(fee1)/600元（300元/包）→ 4.5包 / 1100
 * - 7/5 退货 1包：FIFO 扣 7/2 批次 200元 → 3.5包 / 900
 * - 7/6 报损 1.5包：FIFO 扣 7/2 剩余 1.5包/300 → 2包 / 600
 * - 7/31 盘点 1包：processSet 按最新批次 300元/包回填 → 1包 / 300（盘亏 1包/300）
 * - updatePrice：7/4 改为 3包/1200（400元/包），重算 7/4 之后流水
 *   退货仍扣 7/2 的 1包/200，报损再扣 7/2 剩余 1.5包/300 → 盘点前 3包/1200；7/31 按最新批次 400元/包回填 → 1包 / 400
 *
 * analysyMaterial（begin=7/01，end=7/31）只读 sales+inventory 的 costOfChange*-1：
 * 6/30 盘点流水在区间外，但销售 FIFO 仍扣该批次 0.5包/50。报损不进该接口。
 * 改价前：销售 0.5包/50+2.5包/500=550，7/31 盘亏 1包/300；allStock=4包/850
 * BOM 100元/包：theoryCost=300；costByBomPrice=400；diffByCnt=100；diffByPrice=450；diff=550
 * 改价后：销售仍 550，7/31 盘亏 2包/800；allStock=5包/1350
 * theoryCost=300；costByBomPrice=500；diffByCnt=200；diffByPrice=850；diff=1050
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '完整周期：6/30盘点→改规格→手工入库→销售→订单入库→退货→报损→7/31盘点→改价→报表下载（不含结算单）' })
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

      new UpdateBeefStockUnits(),

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

      new QueryAction({
        name: '记下手工单供操作人校验',
        url: '/app/note/listNote',
        query: {
          status: 'instocked',
          origin: 'hand'
        }
      }, {
        check(result) {
          let row = (result.result.content ?? []).find((item: any) => item.origin == 'hand')
          CheckUtil.expectEqual(
            dayOf(row?.instockTime),
            '2026-07-02',
            `手工入库订单 instockTime 应为2026-07-02，实际=${row?.instockTime}`
          )
        },
        buildVariable(result) {
          let row = (result.result.content ?? []).find((item: any) => item.origin == 'hand')
          return { handNoteIdForOp: row?.noteId }
        }
      }),
      new QueryAction({
        name: '校验手工入库操作人时间',
        url: '/app/noteItem/listNoteItem',
        query: { noteId: '${handNoteIdForOp}' }
      }, {
        check(result) {
          checkInstockOp(result.result.content ?? [], variable.usersId, '2026-07-02', '手工入库')
        }
      }).setRemark('手工入库：校验 instockUser=当前用户，instockTime=2026-07-02'),

      new UploadSalesJuly3(),

      new OrderInstockJuly4(),

      new BackJuly5(),

      new OtherUseJuly6(),

      ...this.buildVerifyStock({
        remark: '期末盘点前校验：2包/600元（7/6报损FIFO扣7/2剩余1.5包/300）',
        name: '校验7月31日盘点前库存',
        cnt: 2,
        buyUnitFee: 1,
        cost: 600
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
        remark: '改价前：销售550 + 7/31盘亏1包/300 = 850；销量3包 theoryCost=300',
        cost: 850,
        theoryCost: 300,
        diff: 550,
        diffByCnt: 100,
        diffByPrice: 450,
        saveAs: 'firstAnalysy'
      }, variable),

      new UpdatePriceJuly4(),

      new Recal().setRemark('改价后物料分析重算'),

      this.buildAnalysyMaterial({
        name: '改价后analysyMaterial',
        remark: '改价后：销售仍550，7/31盘亏2包/800，合计1350',
        cost: 1350,
        theoryCost: 300,
        diff: 1050,
        diffByCnt: 200,
        diffByPrice: 850,
        compareWith: 'firstAnalysy'
      }, variable),

      this.buildPsiCheck(),
      ...this.buildDownloadSteps(variable),
      ...this.buildBatchInstockOpCheck(variable)
    ]
  }

  /**
   * 批量途径入库：额外下一单并 batchProcessNote，校验操作人与时间（不影响主流程库存断言）。
   */
  private buildBatchInstockOpCheck(variable: any): BaseTest[] {
    return [
      new Action({
        name: '批量途径：再下一单牛肉1包',
        remark: '覆盖 batchProcessNote 入库途径，与主流程 processNote 区分',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 1,
            buyUnitFee: 1,
            price: 100,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result
          return {
            batchOpNoteIds: ArrayUtil.toArray(content, 'noteId'),
            batchOpNote: content[0]
          }
        }
      }),
      new Action({
        name: '批量途径：发送订单',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${batchOpNoteIds}',
          status: 'normal'
        }
      }),
      new Action({
        name: '批量途径：batchProcessNote入库',
        remark: '批量入库，校验 instockUser/instockTime',
        url: '/app/note/batchProcessNote',
        method: 'POST',
        param: {
          action: 'instock',
          noteIds: [],
          type: 'purcharse',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        parseHttpParam(param, variable) {
          param.noteIds = variable.batchOpNoteIds
          return param
        }
      }),
      new QueryAction({
        name: '校验批量途径入库操作人时间',
        url: '/app/noteItem/listNoteItem',
        query: { noteId: '${batchOpNote.noteId}' }
      }, {
        check(result) {
          checkInstockOp(result.result.content ?? [], variable.usersId, null, '批量途径入库')
        }
      }).setRemark('批量途径：校验 instockUser/instockTime'),
      new QueryAction({
        name: '校验批量途径订单入库时间',
        url: '/app/note/listNote',
        query: { noteId: '${batchOpNote.noteId}' }
      }, {
        check(result) {
          let row = (result.result.content ?? [])[0]
          CheckUtil.expectEqual(row != null, true, '批量途径应能查到订单')
          CheckUtil.expectEqual(
            row?.instockTime != null && row.instockTime !== '',
            true,
            `批量途径订单 instockTime 不应为空，实际=${row?.instockTime}`
          )
        }
      }).setRemark('批量途径：订单 instockTime 已写入')
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

  /**
   * 进销存 7/1~7/31（改价后）。数量按默认采购单位「包」。
   * 期初=6/30盘点 0.5包/50；采购=手工5包/1000+订单3包/1200−退货1包/200；
   * 出库=销售3包/550+报损1.5包/300+盘亏2包/800；期末=1包/400。
   */
  private buildPsiCheck(): BaseTest {
    let expect = {
      '规格': '1包=100克',
      '期初数量': 0.5, '期初金额': 50, '期初价格': 100,
      '采购数量': 7, '采购金额': 2000, '采购单价': 285.71,
      '出库数量': 6.5, '出库金额': 1650, '出库单价': 253.84,
      '期末数量': 1, '期末金额': 400, '期末单价': 400
    }
    let sumExpects = {
      '期初金额': 50, '采购金额': 2000, '出库金额': 1650, '期末金额': 400
    }
    return new DownloadExcelAction({
      name: '进销存excel校验',
      remark: '下载 psi excel（7/1~7/31，改价后），核对牛肉行与汇总金额',
      url: '/app/state/psi',
      sheetName: '总计',
      param: {
        begin: '2026-07-01',
        end: '2026-07-31',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(rows: any[]) {
        CheckUtil.expectEqual(rows.length, 2, `进销存行数应为1物料+1汇总，实际${rows.length}`)
        let row = rows.find(r => r['物料名称'] == '牛肉')
        CheckUtil.expectEqual(row != null, true, '进销存缺少牛肉行')
        for (let col in expect) {
          let expVal = expect[col]
          let actVal = row[col]
          if (typeof expVal === 'number') {
            // excel导出数值保留2位小数，四舍五入允许0.01误差
            CheckUtil.expectEqual(Math.abs(actVal - expVal) <= 0.01 + 1e-9, true,
              `进销存:牛肉.${col}，期望${expVal}，实际${actVal}`)
          } else {
            CheckUtil.expectEqual(actVal, expVal,
              `进销存:牛肉.${col}，期望${expVal}，实际${actVal}`)
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

  /**
   * 报表中心下载（不含结算单 /app/bill/*）。
   * 先记下 title，再结算三张订单，然后下载。订单号列为 title。
   */
  private buildDownloadSteps(variable: any): BaseTest[] {
    return [
      new QueryAction({
        name: '记下手工单订单号',
        url: '/app/note/listNote',
        query: {
          status: 'instocked',
          origin: 'hand'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? []
          content = content.filter(row => row.origin == 'hand')
          CheckUtil.expectEqual(content.length, 1, `手工单应有1张，实际${content.length}`)
          CheckUtil.expectEqual(String(content[0].title), String(content[0].noteId),
            `手工单title应等于订单号，title=${content[0].title}，noteId=${content[0].noteId}`)
          CheckUtil.expectEqual(String(variable.note?.title), String(variable.note?.noteId),
            `7/4订单title应等于订单号，title=${variable.note?.title}，noteId=${variable.note?.noteId}`)
        },
        buildVariable(result) {
          let row = (result.result.content ?? []).find((item: any) => item.origin == 'hand')
          return {
            handNoteId: row.noteId,
            handTitle: String(row.title)
          }
        }
      }).setRemark('手工单、7/4订单的 title 都等于自身 noteId'),

      new StatementJulyNotes(),

      this.buildStateByMaterialCheck(),
      this.buildStateByProductCheck(),
      this.buildStateNoteCheck(variable),
      this.buildDownloadBySupplierCheck(variable),
      this.buildDownloadNotesCheck(variable, 'hand'),
      this.buildDownloadNotesCheck(variable, 'order'),
      this.buildDownloadNotesCheck(variable, 'back')
    ]
  }

  /**
   * 物料统计 7/1~7/31（改价后）。数量按「几包几克」。
   * 理论=销售3包/550；实际=销售+盘亏5包/1350；入库=手工5+订单3−退货1=7包/2000；
   * 出库=销售3/550+报损1.5/300+盘亏2/800=6.5包/1650；期初0.5包/50；期末1包/400。
   */
  private buildStateByMaterialCheck(): BaseTest {
    let expect = {
      '物料编码': 'MAT_BEEF',
      '规格': '1包=100克',
      '单位': '克',
      '使用频次': 2,
      '理论成本[数量]': '3包',
      '实际成本[数量]': '5包',
      '差异数量': '2包',
      '数量差异率': '66.67%',
      '理论成本[金额]': 550,
      '实际成本[金额]': 1350,
      '差异金额': 800,
      '金额差异率': '145.45%',
      '期初数量': '50克',
      '入库数量': '7包',
      '出库数量': '6包50克',
      '期末数量': '1包',
      '期初金额': 50,
      '入库金额': 2000,
      '出库金额': 1650,
      '期末金额': 400
    }
    let sumExpects = {
      '理论成本[金额]': 550,
      '实际成本[金额]': 1350,
      '差异金额': 800,
      '期初金额': 50,
      '入库金额': 2000,
      '出库金额': 1650,
      '期末金额': 400
    }
    return new DownloadExcelAction({
      name: '物料统计excel校验',
      remark: '下载 stateByMaterial（7/1~7/31，改价后），核对牛肉行与汇总金额',
      url: '/app/state/stateByMaterial',
      sheetName: '物料统计',
      param: {
        begin: '2026-07-01',
        end: '2026-07-31',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(rows: any[]) {
        CheckUtil.expectEqual(rows.length, 2, `物料统计行数应为1物料+1汇总，实际${rows.length}`)
        let row = rows.find(r => r['物料名称'] == '牛肉')
        CheckUtil.expectEqual(row != null, true, '物料统计缺少牛肉行')
        for (let col in expect) {
          CheckUtil.expectEqual(row[col], expect[col], `物料统计:牛肉.${col}，期望${expect[col]}，实际${row[col]}`)
        }
        let sumRow = rows.find(r => r['物料名称'] == '汇总')
        CheckUtil.expectEqual(sumRow != null, true, '物料统计缺少汇总行')
        for (let col in sumExpects) {
          CheckUtil.expectEqual(sumRow[col], sumExpects[col], `物料统计:汇总.${col}，期望${sumExpects[col]}，实际${sumRow?.[col]}`)
        }
      }
    })
  }

  /**
   * 餐品统计：红烧先扣 0.5包/50+1.5包/300=350，水煮再扣 1包/200。
   * 实际=销售+盘亏 5包/1350，按消耗占比分摊差异。
   */
  private buildStateByProductCheck(): BaseTest {
    let expects = {
      '红烧牛肉': {
        '物料编码': 'MAT_BEEF',
        '物料名称': '牛肉',
        '规格': '1包=100克',
        '单位': '克',
        '菜品销量': 2,
        'bom数量': '1包',
        '消耗数量总和': '2包',
        '用料占比': '66.67%',
        '差异数量': '1包33.33克',
        '消耗金额总和': 350,
        '金额占比': '63.64%',
        '差异金额': 509.09
      },
      '水煮牛肉': {
        '物料编码': 'MAT_BEEF',
        '物料名称': '牛肉',
        '规格': '1包=100克',
        '单位': '克',
        '菜品销量': 1,
        'bom数量': '1包',
        '消耗数量总和': '1包',
        '用料占比': '33.33%',
        '差异数量': '66.67克',
        '消耗金额总和': 200,
        '金额占比': '36.36%',
        '差异金额': 290.91
      }
    }
    return new DownloadExcelAction({
      name: '餐品统计excel校验',
      remark: '下载 stateByProduct（7/1~7/31），核对红烧/水煮消耗、占比和差异',
      url: '/app/state/stateByProduct',
      sheetName: '餐品统计',
      param: {
        begin: '2026-07-01',
        end: '2026-07-31',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(rows: any[]) {
        CheckUtil.expectEqual(rows.length, 2, `餐品统计行数应为2，实际${rows.length}`)
        for (let name in expects) {
          let row = rows.find(r => r['菜品名称'] == name)
          CheckUtil.expectEqual(row != null, true, `餐品统计缺少${name}`)
          let expect = expects[name]
          for (let col in expect) {
            CheckUtil.expectEqual(row[col], expect[col], `餐品统计:${name}.${col}，期望${expect[col]}，实际${row[col]}`)
          }
        }
      }
    })
  }

  /**
   * 三张单都已结算。应付 = 手工1000 + 订单1200 − 退货300 = 1900。
   * 供应商 sheet 的订单号是 title。
   */
  private buildStateNoteCheck(variable: any): BaseTest {
    return new MultiSheetDownloadAction({
      name: '应付款excel校验',
      remark: '结算后应付款：供应商1应付1900，三张订单号为 title',
      url: '/app/state/stateNote',
      param: {
        begin: '2026-07-01',
        end: '2026-07-31',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(sheets: any) {
        let names = Object.keys(sheets ?? {})
        CheckUtil.expectEqual(names.join(','), '应付款汇总,供应商1', `应付款sheet应为汇总和供应商1，实际=${names.join(',')}`)
        let sumRows = sheets['应付款汇总'] ?? []
        CheckUtil.expectEqual(sumRows.length, 2, `应付款汇总应有供应商+汇总，实际${sumRows.length}，${JSON.stringify(sumRows)}`)
        let supplier = sumRows.find((r: any) => r['供应商名称'] == '供应商1')
        let total = sumRows.find((r: any) => r['供应商名称'] == '汇总')
        expectCols(supplier, { '应付账款': 1900 }, '应付款汇总:供应商1')
        expectCols(total, { '应付账款': 1900 }, '应付款汇总')

        let handTitle = String(variable.handTitle)
        let orderTitle = String(variable.note.title)
        let backTitle = String(variable.backTitle)
        let noteRows = sheets['供应商1'] ?? []
        CheckUtil.expectEqual(noteRows.length, 4, `供应商1应有3单+汇总，实际${noteRows.length}，${JSON.stringify(noteRows)}`)
        let hand = noteRows.find((r: any) => r['订单号'] == handTitle)
        let order = noteRows.find((r: any) => r['订单号'] == orderTitle)
        let back = noteRows.find((r: any) => r['订单号'] == backTitle)
        expectCols(hand, {
          '日期': '2026-07-02',
          '物料数量': 1,
          '入库金额': 1000,
          '结算金额': 1000,
          '评分': '没有评分'
        }, '应付款手工单')
        expectCols(order, {
          '日期': '2026-07-04',
          '物料数量': 1,
          '入库金额': 1200,
          '结算金额': 1200,
          '评分': '没有评分'
        }, '应付款7/4订单')
        expectCols(back, {
          '日期': '2026-07-05',
          '物料数量': 1,
          '入库金额': -300,
          '结算金额': -300,
          '评分': '没有评分'
        }, '应付款退货单')
      }
    })
  }

  /**
   * 按供应商导订单。三张都已结算，title=各自 noteId。
   * 手工 5包/1000；7/4 订货仍2包、入库3包/1200、订货金额800；退货1包按下单价300取负。
   * 结算金额等于入库金额：1000 + 1200 − 300 = 1900。
   */
  private buildDownloadBySupplierCheck(variable: any): BaseTest {
    return new MultiSheetDownloadAction({
      name: '按供应商导订单excel校验',
      remark: '核对供应商汇总、三张订单的 title 与金额，退货数量和金额为负',
      url: '/app/note/downloadBySupplier',
      param: {
        begin: '2026-07-01',
        end: '2026-07-31',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(sheets: any) {
        let handTitle = String(variable.handTitle)
        let orderTitle = String(variable.note.title)
        let backTitle = String(variable.backTitle)
        CheckUtil.expectEqual(handTitle, String(variable.handNoteId), '手工单title应等于noteId')
        CheckUtil.expectEqual(orderTitle, String(variable.note.noteId), '7/4订单title应等于noteId')
        CheckUtil.expectEqual(backTitle, String(variable.backNoteId), '退货单title应等于noteId')

        let sumRows = sheets['供应商列表']
        CheckUtil.expectEqual(sumRows != null, true, `缺少 sheet「供应商列表」，实际=${Object.keys(sheets ?? {}).join(',')}`)
        CheckUtil.expectEqual(sumRows.length, 2, `供应商列表应有供应商+汇总共2行，实际${sumRows.length}`)
        let supplier = sumRows.find((r: any) => r['供应商名称'] == '供应商1')
        CheckUtil.expectEqual(supplier != null, true, '供应商列表缺少供应商1')
        expectCols(supplier, {
          '订单数量': 3,
          '未入库订单数量': 0,
          '未对账数量': 0,
          '已对账数量': 3,
          '订货金额': 1500,
          '入库金额': 1900,
          '结算金额': 1900
        }, '供应商列表:供应商1')
        let sum = sumRows.find((r: any) => r['供应商名称'] == '汇总')
        expectCols(sum, {
          '订单数量': 3,
          '未入库订单数量': 0,
          '未对账数量': 0,
          '已对账数量': 3,
          '订货金额': 1500,
          '入库金额': 1900,
          '结算金额': 1900
        }, '供应商列表:汇总')

        let noteRows = sheets['供应商1']
        CheckUtil.expectEqual(noteRows != null, true, '缺少 sheet「供应商1」')
        CheckUtil.expectEqual(noteRows.length, 4, `供应商1应有3单+汇总，实际${noteRows.length}，${JSON.stringify(noteRows)}`)
        let hand = noteRows.find((r: any) => r['订单号'] == handTitle)
        let order = noteRows.find((r: any) => r['订单号'] == orderTitle)
        let back = noteRows.find((r: any) => r['订单号'] == backTitle)
        CheckUtil.expectEqual(hand != null, true, `供应商1缺少手工单订单号${handTitle}`)
        CheckUtil.expectEqual(order != null, true, `供应商1缺少7/4订单号${orderTitle}`)
        CheckUtil.expectEqual(back != null, true, `供应商1缺少退货单订单号${backTitle}`)
        expectCols(hand, {
          '订单类型': '订货单',
          '状态名称': '已对账',
          '物料数量': 1,
          '订货金额': 1000,
          '入库金额': 1000,
          '结算金额': 1000,
          '发单日期': '2026-07-02'
        }, '手工单')
        expectCols(order, {
          '订单类型': '订货单',
          '状态名称': '已对账',
          '物料数量': 1,
          '订货金额': 800,
          '入库金额': 1200,
          '结算金额': 1200,
          '发单日期': '2026-07-04'
        }, '7/4订单')
        expectCols(back, {
          '订单类型': '退货单',
          '状态名称': '已对账',
          '物料数量': 1,
          '订货金额': -300,
          '入库金额': -300,
          '结算金额': -300,
          '发单日期': '2026-07-05'
        }, '退货单')

        let materialRows = (sheets['供应商1的物料'] ?? []).filter((r: any) => r && r['物料名'] == '牛肉')
        CheckUtil.expectEqual(materialRows.length, 3, `物料行应有3条牛肉，实际${JSON.stringify(sheets['供应商1的物料'])}`)
        let handItem = materialRows.find((r: any) => r['订单号'] == handTitle)
        let orderItem = materialRows.find((r: any) => r['订单号'] == orderTitle)
        let backItem = materialRows.find((r: any) => r['订单号'] == backTitle)
        expectCols(handItem, {
          '单位': '包',
          '订货数量': 5,
          '入库数量': 5,
          '结算数量': 5,
          '价格': 200,
          '订货金额': 1000,
          '入库金额': 1000,
          '结算金额': 1000
        }, '手工单物料')
        expectCols(orderItem, {
          '单位': '包',
          '订货数量': 2,
          '入库数量': 3,
          '结算数量': 3,
          '价格': 400,
          '订货金额': 800,
          '入库金额': 1200,
          '结算金额': 1200
        }, '7/4订单物料')
        expectCols(backItem, {
          '单位': '包',
          '订货数量': -1,
          '入库数量': -1,
          '结算数量': -1,
          '价格': 300,
          '订货金额': -300,
          '入库金额': -300,
          '结算金额': -300
        }, '退货单物料')
      }
    })
  }

  /** 单张订单下载：订单一览的订单号是 title，且存在以 title 命名的 sheet */
  private buildDownloadNotesCheck(variable: any, which: 'hand' | 'order' | 'back'): BaseTest {
    let opt = {
      hand: {
        name: '下载手工单',
        noteId: '${handNoteId}',
        titleKey: 'handTitle',
        idKey: 'handNoteId',
        cost: 1000,
        instockCost: 1000
      },
      order: {
        name: '下载7/4订单',
        noteId: '${note.noteId}',
        titleKey: 'note.title',
        idKey: 'note.noteId',
        cost: 800,
        instockCost: 1200
      },
      back: {
        name: '下载退货单',
        noteId: '${backNoteId}',
        titleKey: 'backTitle',
        idKey: 'backNoteId',
        cost: 300,
        instockCost: 300
      }
    }[which]
    return new MultiSheetDownloadAction({
      name: opt.name,
      remark: `${opt.name}：订单一览订单号=title，sheet 名也是 title`,
      url: '/app/note/downloadNotes',
      param: {
        noteId: opt.noteId,
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(sheets: any) {
        let title = String(readVar(variable, opt.titleKey))
        let noteId = String(readVar(variable, opt.idKey))
        CheckUtil.expectEqual(title, noteId, `${opt.name} title应等于noteId，title=${title}，noteId=${noteId}`)
        CheckUtil.expectEqual(sheets[title] != null, true, `${opt.name}缺少以订单号命名的sheet，实际=${Object.keys(sheets ?? {}).join(',')}`)
        let rows = sheets['订单一览']
        CheckUtil.expectEqual(rows != null, true, `${opt.name}缺少订单一览`)
        let row = (rows ?? []).find((r: any) => r['订单号'] == title)
        CheckUtil.expectEqual(row != null, true, `${opt.name}订单一览缺少订单号${title}，实际=${JSON.stringify(rows)}`)
        expectCols(row, {
          '供货商': '供应商1',
          '物料数': 1,
          '订货金额': opt.cost,
          '入库金额': opt.instockCost,
          '评分': '没有评分'
        }, opt.name)
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

/** 结算手工单、7/4订单、退货单。结算金额用入库金额。 */
class StatementJulyNotes extends TestCase {
  constructor() {
    super({ remark: 'statmentNote：手工1000、7/4订单1200、退货300' })
  }

  getName(): string {
    return '结算三张订单'
  }

  protected buildActions(): BaseTest[] {
    return [
      this.buildOne('结算手工单', '${handNoteId}', 1000),
      this.buildOne('结算7/4订单', '${note.noteId}', 1200),
      this.buildOne('结算退货单', '${backNoteId}', 300)
    ]
  }

  private buildOne(name: string, noteId: string, statementCost: number): BaseTest {
    return new Action({
      name,
      remark: `statmentNote：结算金额 ${statementCost}`,
      url: '/app/note/statmentNote',
      param: {
        noteId,
        statementCost,
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    })
  }
}

/** updateMaterial：supplierUnitsName=包 优先于 isSupplier，校验 material.stockUnitsId 为包 */
class UpdateBeefStockUnits extends TestCase {
  constructor() {
    super({ remark: 'updateMaterial：isSupplier 在克上，supplierUnitsName=包，stockUnitsId 应取包' })
  }

  getName(): string {
    return 'updateMaterial设置stockUnitsId'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'updateMaterial:supplierUnitsName=包',
        remark: '规格仍为克+包；isSupplier 标在克上，supplierUnitsName=包，stockUnitsId 应改为包',
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${materialMap.牛肉.materialId}',
          name: '牛肉',
          code: 'MAT_BEEF',
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1, isSupplier: true },
            { name: '包', fee: 100, isSupplier: false }
          ],
          supplierUnitsName: '包',
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),
      new Action({
        name: '校验牛肉stockUnitsId为包',
        remark: 'free/query：material.stockUnitsId 应等于单位「包」的 unitsId，且不是「克」',
        url: '/free/query',
        param: {
          array: [
            {
              table: 'material',
              query: {
                materialId: '${materialMap.牛肉.materialId}',
                warehouseGroupId: '${warehouse.warehouseGroupId}',
                isDel: 0
              }
            },
            {
              table: 'units',
              query: {
                name: ['克', '包'],
                isDel: 0
              }
            }
          ]
        }
      }, {
        check(result) {
          let materials = result.result?.material ?? []
          let units = result.result?.units ?? []
          let beef = materials[0]
          CheckUtil.expectEqual(beef != null, true, '未查到牛肉物料')
          let bag = units.find((row: any) => row.name === '包')
          let gram = units.find((row: any) => row.name === '克')
          CheckUtil.expectEqual(bag?.unitsId != null, true, '未查到单位「包」')
          CheckUtil.expectEqual(gram?.unitsId != null, true, '未查到单位「克」')
          CheckUtil.expectEqual(
            String(beef.stockUnitsId) !== String(gram.unitsId),
            true,
            `stockUnitsId 不应是克（isSupplier 被 supplierUnitsName 覆盖），实际=${beef.stockUnitsId}`
          )
          CheckUtil.expectEqual(
            String(beef.stockUnitsId),
            String(bag.unitsId),
            `牛肉 stockUnitsId 应为包(${bag.unitsId})，实际=${beef.stockUnitsId}`
          )
        }
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
    let variable = this.getVariable()
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
        remark: '物料途径全量入库',
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
        remark: 'updateNoteTime → 2026-07-04，同步 noteItem.instockTime',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${note.noteId}',
          sysAddTime: '2026-07-04 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),
      new QueryAction({
        name: '校验物料途径入库操作人时间',
        url: '/app/noteItem/listNoteItem',
        query: { noteId: '${note.noteId}' }
      }, {
        check(result) {
          checkInstockOp(result.result.content ?? [], variable.usersId, '2026-07-04', '物料途径入库+改时间')
        }
      }).setRemark('物料途径：校验 instockUser，且 updateNoteTime 后 instockTime=2026-07-04'),
      new QueryAction({
        name: '校验物料途径订单入库时间',
        url: '/app/note/listNote',
        query: { noteId: '${note.noteId}' }
      }, {
        check(result) {
          let row = (result.result.content ?? [])[0]
          CheckUtil.expectEqual(row != null, true, '物料途径应能查到订单')
          CheckUtil.expectEqual(
            row?.instockTime != null && row.instockTime !== '',
            true,
            `物料途径订单 instockTime 不应为空，实际=${row?.instockTime}`
          )
        }
      }).setRemark('物料途径：订单 instockTime 已写入')
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
          buyUnitFee: 1,
          stockBuyUnitFee: 1,
          instockCnt: 3
        }]
      }).setRemark('updatePrice：instockCnt=3, price=400, buyUnitFee=1, stockBuyUnitFee=1')
    ]
  }
}

/** listOtherType → saveOtherUse：7月6日报损牛肉 1.5包 */
class OtherUseJuly6 extends TestCase {
  constructor() {
    super({ remark: '新增7月6日报损：牛肉 1.5包（FIFO 扣7/2剩余）' })
  }

  getName(): string {
    return '7月6日报损1.5包'
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
        name: '保存其他消耗',
        remark: '报损：牛肉 1.5包，业务日 2026-07-06',
        url: '/app/otherUse/saveOtherUse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherTypeMap.报损}',
          remark: '7月6日报损',
          createTime: '2026-07-06',
          otherItems: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 1.5,
            buyUnitFee: 1
          }]
        }
      })
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
        check(result) {
          let row = result.result.content?.[0]
          CheckUtil.expectEqual(row != null, true, '应查到退货单')
          CheckUtil.expectEqual(String(row.title), String(row.noteId), `退货单title应等于订单号，title=${row?.title}，noteId=${row?.noteId}`)
        },
        buildVariable(result) {
          let row = result.result.content[0]
          return {
            backNoteId: row.noteId,
            backTitle: String(row.title)
          }
        }
      }).setRemark('取退货单 noteId，title 应等于订单号'),
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

import { ArrayUtil, BaseTest, CheckUtil, DownloadExcelAction, TestCase } from "testflow";
import path from "path";
import PreTestWithMeat from "../PreTestWithMeat";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";
import AddMaterial from "../../action/material/AddMaterial";
import ListMaterial from "../../action/material/ListMaterial";
import Upload from "../../action/Upload";
import QueryAction from "../../action/QueryAction";
import ListNoteGroup from "../../action/note/ListNoteGroup";

/**
 * 物料统计和餐品统计（见同目录 FlowStateMaterialAndProdcut.md）。
 *
 * 三次入库价格不同，验证 FIFO（先进先出，销售/退货/盘亏按最旧批次成本扣减）：
 * - 5/30 盘点（除羊肉）@1元/g：牛2包/猪300g/白菜100g/竹笋100g
 * - 6/1 订单入库 @2元/g：牛3包/羊4包/猪500g
 * - bom：每份消耗 10克（牛肉 0.1包）；猪肉炖粉条=猪肉20克+牛肉0.05包/份
 *   （多物料餐品：猪肉炖粉条含2个物料；物料复用：猪肉、牛肉各被2个餐品消耗，频次=2）
 * - 6/10 销售 5/4/6 份；6/15 手工入库各100g @3元/g；6/20 销售 3/2/4 份+猪肉炖粉条2份；
 *   6/28 其他消耗报损羊/猪各100g；6/29 退货各1包(猪100g)
 * - 6/30 盘点：牛4包/900(盘亏30g清@1批次)、羊200/500(盘亏20g清@2批次-40元)、
 *   猪80/240(盘亏480g，只剩最后一批@3手工入库80g/-980元)、
 *   竹笋120(盘盈20g超maxCnt新建批次@1单价+20元，全月仅两次盘点)；白菜全月无变化
 * - 7/1 手工入库 @4元/g（bussinessDate 正好压在 end+1天 边界上，不能进6月统计）
 * - 物料分析（6/1~6/30）核对 excel 每行与汇总：物料编码（MAT001~MAT005）、
 *   数量列（stockDomain.createName 的「几包几克」文本）、金额列分别校验
 * - 餐品分析（6/1~6/30）核对 excel：菜品×物料行（销量/bom/消耗/占比/差异）
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '物料统计：三种价格入库测FIFO，含报损otherUse与餐品分析excel校验' })
  }

  getName(): string {
    return '物料与餐品统计'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new PreTestWithMeat(),

      new AddVegetables(),

      new Action({
        name: '5月30日盘点(除羊肉)',
        remark: '牛肉2包/猪肉300g/白菜100g/竹笋100g @1元/g；羊肉不盘点，期初应为0',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-05-30',
          array: [
            { materialId: '${materialMap.牛肉.materialId}', cnt: 2, buyUnitFee: 1, cost: 200 },
            { materialId: '${materialMap.猪肉.materialId}', cnt: 300, buyUnitFee: 1, cost: 300 },
            { materialId: '${materialMap.白菜.materialId}', cnt: 100, buyUnitFee: 1, cost: 100 },
            { materialId: '${materialMap.竹笋.materialId}', cnt: 100, buyUnitFee: 1, cost: 100 }
          ]
        }
      }),

      new OrderInstockJune1(),

      new SetupBom(),

      new UploadSales('上传6月10日销售', 'sales0610',
        '红烧羊肉5份/红烧牛肉4份/炒猪肉6份 → 羊-50g 牛-40g 猪-60g'),

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

      new UploadSales('上传6月20日销售', 'sales0620',
        '红烧羊肉3份/红烧牛肉2份/炒猪肉4份/猪肉炖粉条2份 → 羊-30g 牛-30g(含炖粉条10g) 猪-80g(含炖粉条40g)'),

      new OtherUseJune28(),

      new BackJune29(),

      // 数量：牛 200+300+100-70-100=430；羊 0+400+100-80-100(报损)-100(退)=220；猪 300+500+100-140-100(报损)-100(退)=560
      // 金额按FIFO：
      // 牛 [30@1,300@2,100@3]=930（销售70g与退货100g全部扣@1批次）
      // 羊 [120@2,100@3]=540（销售80+报损100+退货100 均扣@2批次）
      // 猪 [0@1,460@2,100@3]=1220（销售140+报损100扣@1；退货60@1+40@2）
      ...this.buildVerify({
        name: '校验退货后库存',
        remark: '退货后FIFO：牛4.3包(930)/羊220(540)/猪560(1220)/白菜100(100)/竹笋100(100)',
        stocks: [
          { name: '牛肉', cnt: 4.3, buyUnitFee: 1, cost: 930 },
          { name: '羊肉', cnt: 220, buyUnitFee: 1, cost: 540 },
          { name: '猪肉', cnt: 560, buyUnitFee: 1, cost: 1220 },
          { name: '白菜', cnt: 100, buyUnitFee: 1, cost: 100 },
          { name: '竹笋', cnt: 100, buyUnitFee: 1, cost: 100 }
        ]
      }, variable),

      // 盘点已有批次时输入cost被忽略：从最新批次往旧回填/清减
      // 牛：盘亏30g清最旧@1批次(-30元)→900；羊：盘亏20g清@2批次(-40元)→500；
      // 猪：盘亏到80g，只留最后一批@3(6/15手工入库max100)，更早@1/@2被清零 → 240元；
      // 竹笋：盘盈20g超maxCnt新建批次(+20元)→120
      new Action({
        name: '6月30日盘点',
        remark: '牛4包(盘亏30g)、羊200g(盘亏20g@2)、猪80g(盘亏480g只剩最后一批@3)、竹笋120g(盘盈新建批次)；白菜不盘点',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-06-30',
          array: [
            { materialId: '${materialMap.牛肉.materialId}', cnt: 4, buyUnitFee: 1, cost: 900 },
            { materialId: '${materialMap.羊肉.materialId}', cnt: 200, buyUnitFee: 1, cost: 500 },
            { materialId: '${materialMap.猪肉.materialId}', cnt: 80, buyUnitFee: 1, cost: 240 },
            { materialId: '${materialMap.竹笋.materialId}', cnt: 120, buyUnitFee: 1, cost: 120 }
          ]
        }
      }),

      ...this.buildVerify({
        name: '校验期末库存',
        remark: '6/30盘点后：牛4包(900)/羊200(500)/猪80(240只剩@3)/白菜100(100)/竹笋120(120)',
        stocks: [
          { name: '牛肉', cnt: 4, buyUnitFee: 1, cost: 900 },
          { name: '羊肉', cnt: 200, buyUnitFee: 1, cost: 500 },
          { name: '猪肉', cnt: 80, buyUnitFee: 1, cost: 240 },
          { name: '白菜', cnt: 100, buyUnitFee: 1, cost: 100 },
          { name: '竹笋', cnt: 120, buyUnitFee: 1, cost: 120 }
        ]
      }, variable),

      // 边界条件：bussinessDate=2026-07-01 00:00:00 整点，
      // 统计条件是 bussinessDate < end+1天(=7/1 00:00)，这次入库必须被排除
      new Action({
        name: '7月1日手工入库(边界)',
        remark: '牛肉1包/羊肉100g/猪肉100g @4元/g，salesDay=2026-07-01，正好压在统计边界上，不能进6月统计',
        url: '/app/note/createHandInstock',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          salesDay: '2026-07-01',
          items: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 1, buyUnitFee: 1, cost: 400, price: 400, stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.羊肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 100, buyUnitFee: 1, cost: 400, price: 4, stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.猪肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 100, buyUnitFee: 1, cost: 400, price: 4, stockBuyUnitFee: 1
            }
          ]
        }
      }),

      // 7/1入库已生效（库存变了），但下面的6月分析结果必须不变
      ...this.buildVerify({
        name: '校验7月1日入库后库存',
        remark: '7/1入库后：牛5包(1300)/羊300(900)/猪180(640)/白菜100(100)/竹笋120(120)',
        stocks: [
          { name: '牛肉', cnt: 5, buyUnitFee: 1, cost: 1300 },
          { name: '羊肉', cnt: 300, buyUnitFee: 1, cost: 900 },
          { name: '猪肉', cnt: 180, buyUnitFee: 1, cost: 640 },
          { name: '白菜', cnt: 100, buyUnitFee: 1, cost: 100 },
          { name: '竹笋', cnt: 120, buyUnitFee: 1, cost: 120 }
        ]
      }, variable),

      this.buildStateByMaterialCheck(),
      this.buildStateByProductCheck()
    ]
  }

  /** Recal + CheckStock + 金额校验 */
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
   * 物料分析（6/1~6/30，金额按FIFO；差异率=diff/理论，截断2位不四舍五入）。
   * 数量列经 stockDomain.createName 转成「几包几克」文本（羊/牛 1包=100克，猪/白菜/竹笋只有克）。
   * otherUse 计入出库但不计入实际；6/28报损羊/猪各100g；6/30羊盘亏、猪盘亏到只剩最后一批@3。
   * 羊肉MAT001：频次1 理论80克/160元 实际100克/200元(销售80+盘亏20) 差20克/40元(25%) 期初0 入4包/900 出2包/400 末2包/500
   * 牛肉MAT002：频次2 理论70克/70元 实际1包/100元 差30克/30元(42.85%) 期初2包/200 入3包/800 出1包/100 末4包/900
   * 猪肉MAT003：频次2 理论140克/140元 实际620克/1120元(销售140+盘亏480/980) 差480克/980元(342.85%/700%) 期初300/300 入500克/1160 出720克/1220 末80克/240
   * 白菜MAT004：频次0 全0克(差异率100%) 期初=期末=100克/100
   * 竹笋MAT005：频次0 理论0克 实际-20克/-20元 差-20克/-20(100%) 期初100/100 入0 出-20/-20 末120/120
   * 汇总：理论370 实际1400 差1030 期初700 入2860 出1700 末1860
   */
  private buildStateByMaterialCheck(): BaseTest {
    let expects = {
      羊肉: {
        '物料编码': 'MAT001', '使用频次': 1,
        '理论成本[数量]': '80克', '实际成本[数量]': '1包', '差异数量': '20克', '数量差异率': '25%',
        '理论成本[金额]': 160, '实际成本[金额]': 200, '差异金额': 40, '金额差异率': '25%',
        '期初数量': '0克', '入库数量': '4包', '出库数量': '2包', '期末数量': '2包',
        '期初金额': 0, '入库金额': 900, '出库金额': 400, '期末金额': 500
      },
      牛肉: {
        '物料编码': 'MAT002', '使用频次': 2,
        '理论成本[数量]': '70克', '实际成本[数量]': '1包', '差异数量': '30克', '数量差异率': '42.85%',
        '理论成本[金额]': 70, '实际成本[金额]': 100, '差异金额': 30, '金额差异率': '42.85%',
        '期初数量': '2包', '入库数量': '3包', '出库数量': '1包', '期末数量': '4包',
        '期初金额': 200, '入库金额': 800, '出库金额': 100, '期末金额': 900
      },
      猪肉: {
        '物料编码': 'MAT003', '使用频次': 2,
        '理论成本[数量]': '140克', '实际成本[数量]': '620克', '差异数量': '480克', '数量差异率': '342.85%',
        '理论成本[金额]': 140, '实际成本[金额]': 1120, '差异金额': 980, '金额差异率': '700%',
        '期初数量': '300克', '入库数量': '500克', '出库数量': '720克', '期末数量': '80克',
        '期初金额': 300, '入库金额': 1160, '出库金额': 1220, '期末金额': 240
      },
      白菜: {
        '物料编码': 'MAT004', '使用频次': 0,
        '理论成本[数量]': '0克', '实际成本[数量]': '0克', '差异数量': '0克', '数量差异率': '100%',
        '理论成本[金额]': 0, '实际成本[金额]': 0, '差异金额': 0, '金额差异率': '100%',
        '期初数量': '100克', '入库数量': '0克', '出库数量': '0克', '期末数量': '100克',
        '期初金额': 100, '入库金额': 0, '出库金额': 0, '期末金额': 100
      },
      // 特殊场景：只有期初盘点和6/30盘盈，无销售无入库；盘盈计出库为负
      竹笋: {
        '物料编码': 'MAT005', '使用频次': 0,
        '理论成本[数量]': '0克', '实际成本[数量]': '-20克', '差异数量': '-20克', '数量差异率': '100%',
        '理论成本[金额]': 0, '实际成本[金额]': -20, '差异金额': -20, '金额差异率': '100%',
        '期初数量': '100克', '入库数量': '0克', '出库数量': '-20克', '期末数量': '120克',
        '期初金额': 100, '入库金额': 0, '出库金额': -20, '期末金额': 120
      }
    }
    let sumExpects = {
      '理论成本[金额]': 370, '实际成本[金额]': 1400, '差异金额': 1030,
      '期初金额': 700, '入库金额': 2860, '出库金额': 1700, '期末金额': 1860
    }
    return new DownloadExcelAction({
      name: '物料分析excel校验',
      remark: '下载 stateByMaterial excel，核对5个物料行与汇总行',
      url: '/app/state/stateByMaterial',
      param: {
        begin: '2026-06-01',
        end: '2026-06-30',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(rows: any[]) {
        CheckUtil.expectEqual(rows.length, 6, `物料分析行数应为5物料+1汇总，实际${rows.length}`)
        for (let name in expects) {
          let row = rows.find(r => r['物料名称'] == name)
          CheckUtil.expectEqual(row != null, true, `物料分析缺少${name}行`)
          let expect = expects[name]
          for (let col in expect) {
            CheckUtil.expectEqual(row[col], expect[col], `物料分析:${name}.${col}`)
          }
        }
        let sumRow = rows.find(r => r['物料名称'] == '汇总')
        CheckUtil.expectEqual(sumRow != null, true, '物料分析缺少汇总行')
        for (let col in sumExpects) {
          CheckUtil.expectEqual(sumRow[col], sumExpects[col], `物料分析:汇总.${col}`)
        }
      }
    })
  }

  /**
   * 餐品分析（6/1~6/30）：只含有销售的餐品×物料行，按菜品名称排序。
   * 占比=本餐品消耗/该物料全部餐品消耗；差异=物料实际×占比−消耗（实际含盘点盈亏、排除otherUse）。
   * 猪盘亏到只剩最后一批后实际620/1120；羊实际100/200；消耗与占比不变。
   * 炒猪肉×猪：销量10 bom10克 耗100克/100 占比71.42% 差342.85克/700
   * 红烧牛肉×牛：销量6 bom10克 耗60克/60 占比85.71% 差25.71克/25.71
   * 红烧羊肉×羊：销量8 bom10克 耗80克/160 占比100% 差20克/40
   * 猪肉炖粉条×猪：销量2 bom20克 耗40克/40 占比28.57% 差137.14克/280
   * 猪肉炖粉条×牛：销量2 bom5克 耗10克/10 占比14.28% 差4.28克/4.28
   */
  private buildStateByProductCheck(): BaseTest {
    let expects = [
      {
        '菜品名称': '炒猪肉', '物料编码': 'MAT003', '物料名称': '猪肉',
        '菜品销量': 10, 'bom数量': '10克',
        '消耗数量总和': '100克', '用料占比': '71.42%', '差异数量': '342.85克',
        '消耗金额总和': 100, '金额占比': '71.42%', '差异金额': 700
      },
      {
        '菜品名称': '红烧牛肉', '物料编码': 'MAT002', '物料名称': '牛肉',
        '菜品销量': 6, 'bom数量': '10克',
        '消耗数量总和': '60克', '用料占比': '85.71%', '差异数量': '25.71克',
        '消耗金额总和': 60, '金额占比': '85.71%', '差异金额': 25.71
      },
      {
        '菜品名称': '红烧羊肉', '物料编码': 'MAT001', '物料名称': '羊肉',
        '菜品销量': 8, 'bom数量': '10克',
        '消耗数量总和': '80克', '用料占比': '100%', '差异数量': '20克',
        '消耗金额总和': 160, '金额占比': '100%', '差异金额': 40
      },
      {
        '菜品名称': '猪肉炖粉条', '物料编码': 'MAT003', '物料名称': '猪肉',
        '菜品销量': 2, 'bom数量': '20克',
        '消耗数量总和': '40克', '用料占比': '28.57%', '差异数量': '137.14克',
        '消耗金额总和': 40, '金额占比': '28.57%', '差异金额': 280
      },
      {
        '菜品名称': '猪肉炖粉条', '物料编码': 'MAT002', '物料名称': '牛肉',
        '菜品销量': 2, 'bom数量': '5克',
        '消耗数量总和': '10克', '用料占比': '14.28%', '差异数量': '4.28克',
        '消耗金额总和': 10, '金额占比': '14.28%', '差异金额': 4.28
      }
    ]
    return new DownloadExcelAction({
      name: '餐品分析excel校验',
      remark: '下载 stateByProduct excel，核对5行餐品×物料（含多物料餐品与物料复用）',
      url: '/app/state/stateByProduct',
      param: {
        begin: '2026-06-01',
        end: '2026-06-30',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(rows: any[]) {
        CheckUtil.expectEqual(rows.length, expects.length, `餐品分析行数应为${expects.length}，实际${rows.length}`)
        for (let expect of expects) {
          let row = rows.find(r =>
            r['菜品名称'] == expect['菜品名称'] && r['物料名称'] == expect['物料名称']
          )
          CheckUtil.expectEqual(row != null, true,
            `餐品分析缺少${expect['菜品名称']}×${expect['物料名称']}`)
          for (let col in expect) {
            CheckUtil.expectEqual(row[col], expect[col],
              `餐品分析:${expect['菜品名称']}×${expect['物料名称']}.${col}，期望${expect[col]}，实际${row?.[col]}`)
          }
        }
      }
    })
  }
}

/**
 * 增加白菜和竹笋(克)并刷新 materialMap。
 * 白菜：6月内不发生任何变化，验证仍出现在分析表中。
 * 竹笋：特殊场景，只有 5/30 期初盘点和 6/30 盘盈，无销售无入库。
 */
class AddVegetables extends TestCase {
  constructor() {
    super({ remark: '增加白菜（全月无变化）和竹笋（只有期初盘点和6/30盘盈）' })
  }

  getName(): string {
    return '增加白菜和竹笋'
  }

  protected buildActions(): BaseTest[] {
    return [
      new AddMaterial('白菜', {
        buyUnit: [{ name: '克', fee: 1, isSupplier: true }],
        categoryId: '${categoryMap.蔬菜}',
        code: 'MAT004'
      }),
      new AddMaterial('竹笋', {
        buyUnit: [{ name: '克', fee: 1, isSupplier: true }],
        categoryId: '${categoryMap.蔬菜}',
        code: 'MAT005'
      }),
      new ListMaterial()
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

/**
 * 建餐品+bom：红烧羊肉=羊10克/份、红烧牛肉=牛0.1包/份、炒猪肉=猪10克/份、
 * 猪肉炖粉条=猪20克+牛0.05包/份，理论价均 1元/克。
 * 覆盖两种bom场景：一个餐品含多个物料（猪肉炖粉条）；一个物料被多个餐品复用（猪肉、牛肉，使用频次=2）。
 */
class SetupBom extends TestCase {
  constructor() {
    super({ remark: '设置bom：猪肉炖粉条=猪20克+牛0.05包（多物料餐品），猪/牛各被2个餐品复用，理论价1元/克' })
  }

  getName(): string {
    return '设置bom'
  }

  private buildProduct(productName: string, boms: any[]): BaseTest[] {
    return [
      new Action({
        name: `增加餐品:${productName}`,
        remark: `增加餐品${productName}`,
        url: '/app/product/addProduct',
        param: { name: productName }
      }, {
        buildVariable(result) {
          return { productId: result.result.productId }
        }
      }),
      new Action({
        name: `保存bom:${productName}`,
        remark: `${productName}的物料消耗`,
        url: '/app/bom/saveBom',
        param: {
          productId: '${productId}',
          boms
        }
      })
    ]
  }

  protected buildActions(): BaseTest[] {
    return [
      ...this.buildProduct('红烧羊肉', [{
        materialId: '${materialMap.羊肉.materialId}',
        cnt: 10, buyUnitFee: 1, yieldRate: 0, netCnt: 10,
        price: 1, stockBuyUnitFee: 1
      }]),
      ...this.buildProduct('红烧牛肉', [{
        materialId: '${materialMap.牛肉.materialId}',
        cnt: 0.1, buyUnitFee: 1, yieldRate: 0, netCnt: 0.1,
        price: 100, stockBuyUnitFee: 1
      }]),
      ...this.buildProduct('炒猪肉', [{
        materialId: '${materialMap.猪肉.materialId}',
        cnt: 10, buyUnitFee: 1, yieldRate: 0, netCnt: 10,
        price: 1, stockBuyUnitFee: 1
      }]),
      // 多物料餐品：猪肉20克 + 牛肉0.05包(5克)
      ...this.buildProduct('猪肉炖粉条', [
        {
          materialId: '${materialMap.猪肉.materialId}',
          cnt: 20, buyUnitFee: 1, yieldRate: 0, netCnt: 20,
          price: 1, stockBuyUnitFee: 1
        },
        {
          materialId: '${materialMap.牛肉.materialId}',
          cnt: 0.05, buyUnitFee: 1, yieldRate: 0, netCnt: 0.05,
          price: 100, stockBuyUnitFee: 1
        }
      ])
    ]
  }
}

/** 上传销售记录 excel 并保存 */
class UploadSales extends TestCase {
  private stepName: string
  private fileName: string

  constructor(name: string, fileName: string, remark: string) {
    super({ remark })
    this.stepName = name
    this.fileName = fileName
  }

  getName(): string {
    return this.stepName
  }

  protected buildActions(): BaseTest[] {
    return [
      new Upload({
        name: this.stepName,
        remark: `${this.stepName}·上传excel`,
        param: {
          target: 'salesRecord',
          warehouseId: '${warehouse.warehouseId}'
        },
        filePath: path.join(__dirname, '../../../excel/state/', `${this.fileName}.xlsx`)
      }, {
        buildVariable(result) {
          const checkResult = result.result.importResult
          result = result.result
          let fileCols = (result.fileCols ?? []).filter((row: any) => row.targetCol != null)
          fileCols = fileCols.map((row: any) => ({
            targetCol: row.targetCol,
            excelFileId: row.excelFileId
          }))
          return {
            excelFileId: result.excelFileId,
            fileCols,
            uploadChecked: checkResult?.checked
          }
        }
      }),
      new Action({
        name: `保存${this.stepName}`,
        remark: `${this.stepName}·saveExcel`,
        url: '/app/excel/saveExcel',
        param: {
          excelFileId: '${excelFileId}',
          fileCols: '${fileCols}',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        needRunVariable: {
          key: 'uploadChecked',
          not: true
        }
      })
    ]
  }
}

/**
 * 6月28日其他消耗：报损羊肉100g、猪肉100g（FIFO 扣最旧批次）。
 * 落在退货前，验证 otherUse 计入出库但不计入实际成本。
 */
class OtherUseJune28 extends TestCase {
  constructor() {
    super({ remark: '6月28日报损：羊肉100g、猪肉100g（otherUse，FIFO）' })
  }

  getName(): string {
    return '6月28日其他消耗'
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
        name: '保存其他消耗(6月28日)',
        remark: '报损：羊肉100g + 猪肉100g，createTime=2026-06-28',
        url: '/app/otherUse/saveOtherUse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherTypeMap.报损}',
          remark: '6月28日报损',
          createTime: '2026-06-28',
          otherItems: [
            {
              materialId: '${materialMap.羊肉.materialId}',
              cnt: 100,
              buyUnitFee: 1
            },
            {
              materialId: '${materialMap.猪肉.materialId}',
              cnt: 100,
              buyUnitFee: 1
            }
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
      }),

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

import path from "path";
import { BaseTest, CheckUtil, TestCase } from "testflow";
import Action from "../../action/Action";
import CheckCnt from "../../action/CheckCnt";
import CheckStock from "../../action/CheckStock";
import Recal from "../../action/Recal";
import Upload from "../../action/Upload";
import ExcelUploadUtil from "../../util/ExcelUploadUtil";
import StockUtil from "../../util/StockUtil";
import PreTest from "../PreTest";

/**
 * 其他耗用 / 其他入库导入（见同目录 FlowOtherUseUpload.md）。
 *
 * 牛肉创建单位是包，再改成 1包=500克，标准单位仍是包，按克 buyUnitFee=500。
 * 猪肉、羊肉只有包，buyUnitFee=1。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '其他耗用导入：错误不落库，成功按天和类型合并，并校验库存' })
  }

  getName(): string {
    return '其他耗用导入'
  }

  protected getFile(name: string): string {
    if (!name.endsWith('.xlsx')) {
      name += '.xlsx'
    }
    return path.join(__dirname, '../../../excel/flowOtherUseUpload/', name)
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        materialsOpts: [
          { name: '牛肉', category: '肉类', unit: '包', code: 'niurou' },
          { name: '猪肉', category: '肉类', unit: '包', code: 'zhurou' },
          { name: '羊肉', category: '肉类', unit: '包', code: 'yangrou' }
        ]
      }),
      new Action({
        name: '更改牛肉规格',
        remark: '1包=500克，标准单位仍是包',
        url: '/app/material/saveBuyUnit',
        param: {
          materialId: '${materialMap.牛肉.materialId}',
          warehouseId: '${warehouse.warehouseId}',
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 500, isSupplier: true }
          ],
          supplierUnitsName: '包'
        }
      }),
      new Action({
        name: '初始化其他类型',
        remark: '空列表时写入报损、员工餐、研发，以及赠予(isAdd=1)',
        url: '/app/otherType/listOtherType',
        param: {
          isAdd: 0
        }
      }),
      new Action({
        name: '新增类型天上掉的',
        remark: '其他入库类型 isAdd=1',
        url: '/app/otherType/addOtherType',
        param: {
          name: '天上掉的',
          isAdd: 1
        }
      }),

      ...this.buildFailUpload(
        '导入其他入库（错误）',
        'OtherInstock',
        '其他入库错误',
        'instockErrorNo'
      ),
      this.buildOtherUseCnt('错误入库后不应有单据', 0),

      ...this.buildUpload(
        '导入其他入库（正确）',
        'OtherInstock',
        '其他入库正确',
        (importResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '其他入库应导入成功')
        }
      ),
      this.buildOtherUseCnt('其他入库成功应有3条单据', 3),

      ...this.buildFailUpload(
        '导入其他消耗（错误）',
        'OtherUse',
        '其他消耗错误',
        'useErrorNo'
      ),
      this.buildOtherUseCnt('错误消耗不应新增单据', 3),

      ...this.buildUpload(
        '导入其他消耗（正确）',
        'OtherUse',
        '其他消耗正确',
        (importResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '其他消耗应导入成功')
        }
      ),

      ...this.buildVerify(),

      ...this.buildUpdateInstock(),
      ...this.buildUpdateUse(),
      ...this.buildVerifyAfterUpdate()
    ]
  }

  private buildOtherUseCnt(remark: string, cnt: number): CheckCnt {
    return new CheckCnt([
      { table: 'otherUse', cnt }
    ]).setRemark(remark)
  }

  /**
   * 列未全部匹配时走 saveExcel。失败时把 errorNo 记到变量里。
   */
  private buildUpload(
    name: string,
    target: string,
    fileName: string,
    checkImport?: (importResult: any) => void,
    buildImportVariable?: (importResult: any, topResult?: any) => any
  ): BaseTest[] {
    return [
      new Upload({
        name,
        remark: name,
        param: {
          target,
          warehouseId: '${warehouse.warehouseId}'
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

  private buildFailUpload(name: string, target: string, fileName: string, errorNoKey: string): BaseTest[] {
    return [
      ...this.buildUpload(
        name,
        target,
        fileName,
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
        remark: '应出现物料不存在、类型不存在',
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
          CheckUtil.expectEqual(parts.includes('类型不存在'), true, `${name} 应有类型不存在，实际=${msgs}`)
          let extra = parts.filter(text => text !== '物料不存在' && text !== '类型不存在')
          CheckUtil.expectEqual(extra.length, 0, `${name} 出现了其他错误，实际=${msgs}`)
        }
      })
    ]
  }

  private buildVerify(): BaseTest[] {
    return [
      new Recal().setRemark('重算库存'),
      new CheckStock({
        array: [
          { materialId: '${materialMap.牛肉.materialId}', cnt: 60, buyUnitFee: 500 },
          { materialId: '${materialMap.猪肉.materialId}', cnt: 100, buyUnitFee: 1 },
          { materialId: '${materialMap.羊肉.materialId}', cnt: 20, buyUnitFee: 1 }
        ]
      }).setRemark('扣减后数量：牛60克、猪100包、羊20包'),
      new CheckCnt([
        { table: 'otherUse', cnt: 5 },
        { table: 'otherItem', cnt: 7 }
      ]).setRemark('5条单据、7条明细'),
      new Action({
        name: '校验导入结果',
        remark: '单据、明细、流水和库存金额',
        url: '/free/query',
        param: {
          array: ['stock', 'otherUse', 'otherItem', 'stockRecord'].map(table => ({
            table,
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }))
        }
      }, {
        check: (result) => {
          let data = result.result ?? {}
          this.checkStockCost(data.stock ?? [])
          this.checkDocs(data.otherUse ?? [], data.otherItem ?? [])
          this.checkStockRecords(data.stockRecord ?? [])
        }
      })
    ]
  }

  /** 改 1月1日其他入库：牛肉改为 50克，删除猪肉。 */
  private buildUpdateInstock(): BaseTest[] {
    return [
      this.buildLoadUse('取出其他入库', '2026-01-01:天上掉的', 'instockUseId', 'instockTypeId'),
      new Action({
        name: '修改其他入库',
        remark: '1月1日天上掉的：牛肉100克改为50克（单价仍1元/克），删除猪肉',
        url: '/app/otherUse/saveOtherUse',
        param: {
          otherUseId: '${instockUseId}',
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${instockTypeId}',
          isAdd: 1,
          createTime: '2026-01-01',
          remark: '2026-01-01:天上掉的',
          otherItems: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 50,
              buyUnitFee: 500,
              price: 1,
              stockBuyUnitFee: 500
            }
          ]
        }
      })
    ]
  }

  /** 改 1月4日其他消耗：牛肉改为 10克，删除猪肉。 */
  private buildUpdateUse(): BaseTest[] {
    return [
      this.buildLoadUse('取出其他消耗', '2026-01-04:报损', 'consumeUseId', 'consumeTypeId'),
      new Action({
        name: '修改其他消耗',
        remark: '1月4日报损：牛肉40克改为10克，删除猪肉',
        url: '/app/otherUse/saveOtherUse',
        param: {
          otherUseId: '${consumeUseId}',
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${consumeTypeId}',
          isAdd: 0,
          createTime: '2026-01-04',
          remark: '2026-01-04:报损',
          otherItems: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 10,
              buyUnitFee: 500
            }
          ]
        }
      })
    ]
  }

  private buildLoadUse(name: string, remark: string, idKey: string, typeKey: string): Action {
    return new Action({
      name,
      remark: `按备注 ${remark} 取单据`,
      url: '/free/query',
      param: {
        array: [{
          table: 'otherUse',
          query: {
            warehouseId: '${warehouse.warehouseId}',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            isDel: 0,
            remark
          }
        }]
      }
    }, {
      buildVariable(result) {
        let list: any[] = result.result?.otherUse ?? []
        let row = list.find(item => item.remark === remark) ?? list[0]
        CheckUtil.expectEqual(row != null, true, `未找到单据 ${remark}`)
        return {
          [idKey]: row.otherUseId,
          [typeKey]: row.otherTypeId
        }
      }
    })
  }

  /**
   * 改单后的库存：
   * 牛肉 50克/50元 再扣 10克，剩 40克/40元。
   * 猪肉只剩 1月3日 20包/100元。
   * 羊肉未改，仍是 20包/73.33元。
   */
  private buildVerifyAfterUpdate(): BaseTest[] {
    let stocks = [
      { name: '牛肉', cnt: 40, buyUnitFee: 500, cost: 40 },
      { name: '猪肉', cnt: 20, buyUnitFee: 1, cost: 100 },
      { name: '羊肉', cnt: 20, buyUnitFee: 1, cost: 73.33 }
    ]
    return [
      new Recal().setRemark('改单后重算库存'),
      new CheckStock({
        array: stocks.map(row => ({
          materialId: `\${materialMap.${row.name}.materialId}`,
          cnt: row.cnt,
          buyUnitFee: row.buyUnitFee
        }))
      }).setRemark('改单后数量：牛40克、猪20包、羊20包'),
      new Action({
        name: '校验改单后库存金额',
        remark: '牛肉40元、猪肉100元、羊肉73.33元',
        url: '/free/query',
        param: {
          array: [{
            table: 'stock',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        check: (result) => {
          let array: any[] = result.result?.stock ?? []
          for (let expect of stocks) {
            let stock = this.findByMaterial(array, expect.name)
            CheckUtil.expectEqual(stock != null, true, `${expect.name}库存不存在`)
            this.checkMoney(stock.cost, expect.cost, `${expect.name}库存`)
          }
        }
      })
    ]
  }

  private materialId(name: string): any {
    return this.getVariable().materialMap?.[name]?.materialId
  }

  private dayOf(value: any): string {
    if (value instanceof Date) {
      return this.formatLocalDay(value)
    }
    let text = String(value ?? '')
    if (text.includes('T')) {
      let date = new Date(text)
      if (!isNaN(date.getTime())) {
        return this.formatLocalDay(date)
      }
    }
    let found = text.match(/(\d{4}-\d{2}-\d{2})/)
    return found ? found[1] : text.substring(0, 10)
  }

  /** 按本机时区取日历日。接口里的 2026-01-01 00:00 常以 UTC 字符串 2025-12-31T16:00:00.000Z 返回。 */
  private formatLocalDay(value: Date): string {
    let month = value.getMonth() + 1
    let day = value.getDate()
    let monthText = month < 10 ? '0' + month : String(month)
    let dayText = day < 10 ? '0' + day : String(day)
    return `${value.getFullYear()}-${monthText}-${dayText}`
  }

  private findByMaterial(array: any[], name: string): any {
    let materialId = this.materialId(name)
    return array.find(row => String(row.materialId) === String(materialId))
  }

  private checkQty(row: any, cnt: number, buyUnitFee: number, label: string) {
    CheckUtil.expectEqual(row != null, true, `${label}不存在`)
    CheckUtil.expectEqual(StockUtil.isEq(
      { cnt: Number(row.cnt), buyUnitFee: Number(row.buyUnitFee) },
      { cnt, buyUnitFee }
    ), true, `${label}数量不对`)
  }

  private checkPrice(row: any, price: number, buyUnitFee: number, label: string) {
    CheckUtil.expectEqual(StockUtil.isEqPrice(
      { price: Number(row.price), buyUnitFee: Number(row.stockBuyUnitFee) },
      { price, buyUnitFee }
    ), true, `${label}单价不对`)
  }

  private checkMoney(actual: any, expected: number, label: string) {
    CheckUtil.expectEqual(StockUtil.isNumEq(Number(actual), expected), true, `${label}金额不对，实际=${actual}`)
  }

  private checkStockCost(array: any[]) {
    let expects = [
      { name: '牛肉', cost: 60 },
      { name: '猪肉', cost: 260 },
      { name: '羊肉', cost: 73.33 }
    ]
    for (let expect of expects) {
      let stock = this.findByMaterial(array, expect.name)
      CheckUtil.expectEqual(stock != null, true, `${expect.name}库存不存在`)
      this.checkMoney(stock.cost, expect.cost, `${expect.name}库存`)
    }
  }

  private findUse(array: any[], remark: string): any {
    let row = array.find(item => item.remark === remark)
    CheckUtil.expectEqual(row != null, true, `应有单据 ${remark}`)
    return row
  }

  private checkDocs(uses: any[], items: any[]) {
    CheckUtil.expectEqual(uses.length, 5, 'otherUse 应为5条')
    CheckUtil.expectEqual(items.length, 7, 'otherItem 应为7条')
    let docs = [
      { remark: '2026-01-01:天上掉的', day: '2026-01-01', isAdd: 1, cost: 300 },
      { remark: '2026-01-02:赠予', day: '2026-01-02', isAdd: 1, cost: 110 },
      { remark: '2026-01-03:赠予', day: '2026-01-03', isAdd: 1, cost: 100 },
      { remark: '2026-01-04:报损', day: '2026-01-04', isAdd: 0, cost: 0 },
      { remark: '2026-01-05:员工餐', day: '2026-01-05', isAdd: 0, cost: 0 }
    ]
    for (let doc of docs) {
      let row = this.findUse(uses, doc.remark)
      CheckUtil.expectEqual(Number(row.isAdd), doc.isAdd, `${doc.remark} isAdd`)
      this.checkMoney(row.cost, doc.cost, doc.remark)
      CheckUtil.expectEqual(this.dayOf(row.createTime), doc.day, `${doc.remark} 日期，实际=${row.createTime}`)
    }
    this.checkInstockItems(uses, items)
    this.checkUseItems(uses, items)
  }

  private itemsOf(array: any[], otherUseId: any): any[] {
    return array.filter(row => String(row.otherUseId) === String(otherUseId))
  }

  private checkInstockItems(uses: any[], array: any[]) {
    let day01 = this.findUse(uses, '2026-01-01:天上掉的')
    let day02 = this.findUse(uses, '2026-01-02:赠予')
    let day03 = this.findUse(uses, '2026-01-03:赠予')
    let rows01 = this.itemsOf(array, day01.otherUseId)
    CheckUtil.expectEqual(rows01.length, 2, '1月1日应有2条明细')
    let beef = this.findByMaterial(rows01, '牛肉')
    this.checkQty(beef, 100, 500, '1月1日牛肉')
    this.checkPrice(beef, 1, 500, '1月1日牛肉')
    let pork = this.findByMaterial(rows01, '猪肉')
    this.checkQty(pork, 100, 1, '1月1日猪肉')
    this.checkPrice(pork, 2, 1, '1月1日猪肉')

    let rows02 = this.itemsOf(array, day02.otherUseId)
    CheckUtil.expectEqual(rows02.length, 1, '1月2日羊肉应合并成1条')
    let lamb = rows02[0]
    this.checkQty(lamb, 30, 1, '1月2日羊肉')
    this.checkPrice(lamb, 110, -30, '1月2日羊肉')

    let rows03 = this.itemsOf(array, day03.otherUseId)
    CheckUtil.expectEqual(rows03.length, 1, '1月3日应有1条猪肉')
    let pork2 = rows03[0]
    this.checkQty(pork2, 20, 1, '1月3日猪肉')
    this.checkPrice(pork2, 5, 1, '1月3日猪肉')
  }

  private checkUseItems(uses: any[], array: any[]) {
    let day04 = this.findUse(uses, '2026-01-04:报损')
    let day05 = this.findUse(uses, '2026-01-05:员工餐')
    let rows04 = this.itemsOf(array, day04.otherUseId)
    CheckUtil.expectEqual(rows04.length, 2, '1月4日应有2条明细')
    let beef = this.findByMaterial(rows04, '牛肉')
    this.checkQty(beef, 40, 500, '1月4日牛肉')
    this.expectNoPrice(beef, '1月4日牛肉')
    let pork = this.findByMaterial(rows04, '猪肉')
    this.checkQty(pork, 20, 1, '1月4日猪肉')
    this.expectNoPrice(pork, '1月4日猪肉')

    let rows05 = this.itemsOf(array, day05.otherUseId)
    CheckUtil.expectEqual(rows05.length, 1, '1月5日羊肉应合并成1条')
    this.checkQty(rows05[0], 10, 1, '1月5日羊肉')
    this.expectNoPrice(rows05[0], '1月5日羊肉')
  }

  private expectNoPrice(row: any, label: string) {
    CheckUtil.expectEqual(row.price == null, true, `${label}不应写价格`)
    CheckUtil.expectEqual(row.stockBuyUnitFee == null, true, `${label}不应写价格单位`)
  }

  private checkStockRecords(array: any[]) {
    let instock = array.filter(row => row.type === 'otherInstock')
    let use = array.filter(row => row.type === 'otherUse')
    CheckUtil.expectEqual(instock.length, 4, '其他入库流水应为4条')
    CheckUtil.expectEqual(use.length, 3, '其他消耗流水应为3条')
    this.checkInstockRecord(instock, '牛肉', 100, 500, 100)
    this.checkInstockRecord(instock, '猪肉', 100, 1, 200)
    this.checkInstockRecord(instock, '猪肉', 20, 1, 100)
    this.checkInstockRecord(instock, '羊肉', 30, 1, 110)
    this.checkUseRecord(use, '牛肉', -40, 500)
    this.checkUseRecord(use, '猪肉', -20, 1)
    this.checkUseRecord(use, '羊肉', -10, 1)
  }

  private checkInstockRecord(array: any[], name: string, cnt: number, buyUnitFee: number, cost: number) {
    let materialId = this.materialId(name)
    let row = array.find(item =>
      String(item.materialId) === String(materialId) && StockUtil.isNumEq(Number(item.cost), cost)
    )
    this.checkQty(row, cnt, buyUnitFee, `入库流水${name}`)
    CheckUtil.expectEqual(row.calType, 'add', `入库流水${name}方向`)
    this.checkMoney(row.cost, cost, `入库流水${name}`)
  }

  private checkUseRecord(array: any[], name: string, cnt: number, buyUnitFee: number) {
    let row = this.findByMaterial(array, name)
    this.checkQty(row, cnt, buyUnitFee, `消耗流水${name}`)
    CheckUtil.expectEqual(row.calType, 'sub', `消耗流水${name}方向`)
    this.checkMoney(row.cost, 0, `消耗流水${name}`)
  }
}

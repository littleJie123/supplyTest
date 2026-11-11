import { BaseTest, CheckUtil, TestCase } from "testflow";
import { expectSalesCost } from "../../util/expectSalesCost";
import SaveMaterial from "../../action/material/SaveMaterial";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import Upload from "../../action/Upload";
import path from "path";
import Action from "../../action/Action";
import GetMap from "../../action/GetMap";
import Recal from "../../action/Recal";
import ExcelUploadUtil from "../../util/ExcelUploadUtil";
import StockUtil from "../../util/StockUtil";

export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    let ret: BaseTest[] = [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),

    ]

    ret.push(...this.buildUpload('上传物料', 'material', '物料'))
    ret.push(...buildInventoryBeforeBom())
    ret.push(...this.buildUpload('上传bom', 'bom', 'bom'))
    ret.push(...buildCheckBomStock(variable))
    ret.push(...this.buildUpload('上传销售记录', 'salesRecord', '销售记录'))

    ret.push(new Action({
      name: '查询销售记录',
      url: '/app/salesRecord/listSalesRecord',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqual(content.length, 5);
      }
    }))

    ret.push(...this.buildUpload('上传销售记录[错误]', 'salesRecord', '销售记录[错误]'))

    ret.push(new Action({
      name: '查询销售记录',
      url: '/app/salesRecord/listSalesRecord',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        let content: any[] = result.result.content;
        CheckUtil.expectEqual(content.length, 6);
        let wrong = content.filter(row => row.cnt != 4)
        CheckUtil.expectEqual(wrong.length, 0);
      }
    }))

    ret.push(new Action({
      name: '校验cost、noBom和salesRecordBom',
      url: '/free/query',
      param: {
        array: [
          {
            table: 'salesRecord',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          },
          {
            table: 'salesRecordBom',
            query: {
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }
        ]
      }
    }, {
      check(result) {
        expectSalesCost(result.result?.salesRecord ?? [], result.result?.salesRecordBom ?? [], '上传销售记录')
      }
    }).setHighlight())

    ret.push(...buildDayActions(variable))
    return ret;
  }
  getName(): string {
    return '销售记录';
  }

  /**
   * 列能自动匹配时上传即导入；匹配不上时再 saveExcel。
   */
  private buildUpload(name: string, target: string, fileName: string): BaseTest[] {
    return [
      new Upload({
        name,
        param: {
          target,
          warehouseId: '${warehouse.warehouseId}'
        },
        filePath: this.getFile(fileName)
      }, {
        buildVariable(result) {
          let data = result.result ?? {}
          return {
            excelFileId: data.excelFileId,
            fileCols: ExcelUploadUtil.buildSaveFileCols(data.fileCols),
            allMap: !!data.allMap
          }
        }
      }),
      new Action({
        name: `保存${name}`,
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
        }
      })
    ]
  }

  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    return path.join(__dirname, '../../../excel/FlowSalesRecord/', strPath)
  }

}

/** 盘点写入的库存，单位是瓶 */
const BOM_INIT_CNT = 1000

/** BOM 用到的物料，以及物料表上的单价 */
const BOM_MATERIALS: { name: string, price: number }[] = [
  { name: '猪肉', price: 10 },
  { name: '羊肉', price: 12 },
  { name: '牛肉', price: 20 },
  { name: '青菜', price: 2 },
  { name: '豆腐', price: 3 },
]

/**
 * 上传 BOM 前先盘点。营业日早于销售日期，后面的销售会从这批库存往下扣。
 */
function buildInventoryBeforeBom(): BaseTest[] {
  return [
    new GetMap(),
    new Action({
      name: '盘点BOM物料',
      url: '/app/inventory/setInventoryByArray',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        bussinessDate: '2026-04-01',
        array: BOM_MATERIALS.map(row => ({
          materialId: '${material.' + row.name + '}',
          cnt: BOM_INIT_CNT,
          buyUnitFee: 1,
          cost: BOM_INIT_CNT * row.price
        }))
      }
    })
  ]
}

/**
 * 保存 BOM 还不扣销售。重算后，库存应仍是盘点数量。
 */
function buildCheckBomStock(variable: any): BaseTest[] {
  return [
    new Recal(),
    new Action({
      name: '验证库存',
      url: '/free/query',
      param: {
        array: [
          {
            table: 'stock',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }
        ]
      }
    }, {
      check(result) {
        let stocks: any[] = result.result?.stock ?? []
        for (let item of BOM_MATERIALS) {
          let materialId = variable.material?.[item.name]
          CheckUtil.expectEqual(materialId != null, true, `应能找到物料${item.name}`)
          let row = stocks.find(stock => Number(stock.materialId) == Number(materialId))
          CheckUtil.expectEqual(row != null, true, `${item.name}应有库存`)
          CheckUtil.expectEqual(
            StockUtil.isEq(
              { cnt: Number(row?.cnt ?? 0), buyUnitFee: feeOf(row?.buyUnitFee) },
              { cnt: BOM_INIT_CNT, buyUnitFee: 1 }
            ),
            true,
            `${item.name}库存应为${BOM_INIT_CNT}，实际=${row?.cnt}/${row?.buyUnitFee}`
          )
        }
      }
    }).setHighlight()
  ]
}

/** 改售价后，旧更新接口写入的单价 */
const SALE_PRICE = 12.5

/** 删除后再新增的数量 */
const ADD_CNT = 3

/** 原有新增接口覆盖时写入的数量 */
const OVERWRITE_CNT = 7

function toNum(num: number, n: number): number {
  if (num == null) {
    return 0
  }
  let scale = 1
  for (let i = 0; i < n; i++) {
    scale = scale * 10
  }
  let scaled = num * scale
  let ret = Math.round(scaled)
  if (Math.abs(scaled - (ret + 1)) < 0.001) {
    ret = ret + 1
  }
  return ret / scale
}

function feeOf(value: any): number {
  if (value == null || value === '') {
    return 1
  }
  return Number(value)
}

function expectCnt(actual: any, expected: any, msg: string) {
  CheckUtil.expectEqual(
    StockUtil.isEq(
      { cnt: Number(actual ?? 0), buyUnitFee: 1 },
      { cnt: Number(expected ?? 0), buyUnitFee: 1 }
    ),
    true,
    `${msg}，实际=${actual}，期望=${expected}`
  )
}

function expectPrice(actual: any, expected: any, msg: string) {
  CheckUtil.expectEqual(
    StockUtil.isEqPrice(
      { price: Number(actual ?? 0), buyUnitFee: 1 },
      { price: Number(expected ?? 0), buyUnitFee: 1 }
    ),
    true,
    `${msg}，实际=${actual}，期望=${expected}`
  )
}

function expectStockCnt(actual: any, expected: { cnt: number, buyUnitFee: any }, msg: string) {
  CheckUtil.expectEqual(
    StockUtil.isEq(
      { cnt: Number(actual?.cnt ?? 0), buyUnitFee: feeOf(actual?.buyUnitFee) },
      { cnt: Number(expected.cnt ?? 0), buyUnitFee: feeOf(expected.buyUnitFee) }
    ),
    true,
    `${msg}，实际=${actual?.cnt}/${actual?.buyUnitFee}，期望=${expected.cnt}/${expected.buyUnitFee}`
  )
}

function toSalesDay(value: any): string {
  if (value == null || value === '') {
    return ''
  }
  if (typeof value == 'string' && value.indexOf('T') < 0 && !value.endsWith('Z')) {
    let matched = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (matched) {
      return matched[1]
    }
  }
  let date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }
  let month = String(date.getMonth() + 1).padStart(2, '0')
  let day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function mapById(rows: any[], key: string): { [id: number]: any } {
  let map: { [id: number]: any } = {}
  for (let row of rows ?? []) {
    map[Number(row[key])] = row
  }
  return map
}

function hasId(ids: any[], id: any): boolean {
  return (ids ?? []).some(row => Number(row) == Number(id))
}

function sumRows(rows: any[]): { dayCnt: number, dayCost: number, dayMoney: number } {
  let dayCnt = 0
  let dayCost = 0
  let dayMoney = 0
  for (let row of rows ?? []) {
    dayCnt += Number(row.cnt ?? 0)
    dayCost += Number(row.cost ?? 0)
    dayMoney += Number(row.money ?? 0)
  }
  return { dayCnt, dayCost, dayMoney }
}

function errorMessage(result: any): string {
  return String(result?.error?.message ?? result?.message ?? '')
}

function warehouseParam(): any {
  return {
    warehouseId: '${warehouse.warehouseId}',
    salesDay: '${salesDay}'
  }
}

function salesPackParam(): any {
  return {
    array: [
      {
        table: 'salesRecord',
        query: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        }
      },
      {
        table: 'salesRecordBom',
        query: {
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        }
      },
      {
        table: 'salesStock',
        query: {
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        }
      },
      {
        table: 'stockRecord',
        query: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        }
      },
      {
        table: 'product',
        query: {
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      },
      {
        table: 'bom',
        query: {
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          productId: '${updateProductId}',
          isDel: 0
        }
      }
    ]
  }
}

function copyIdText(copies: any[], salesRecordId: any): string {
  return (copies ?? [])
    .filter(row => Number(row.salesRecordId) == Number(salesRecordId))
    .map(row => Number(row.salesRecordBomId))
    .sort((a, b) => a - b)
    .join(',')
}

function copiesOf(copies: any[], salesRecordId: any): any[] {
  return (copies ?? []).filter(row => Number(row.salesRecordId) == Number(salesRecordId))
}

function expectLinkedStock(salesRecordId: any, salesCnt: any, copies: any[], salesStocks: any[], stockRecords: any[], label: string) {
  let idSet: { [id: number]: boolean } = {}
  for (let link of salesStocks ?? []) {
    if (Number(link.salesRecordId) == Number(salesRecordId)) {
      idSet[Number(link.stockRecordId)] = true
    }
  }
  let stocks = (stockRecords ?? []).filter(row => idSet[Number(row.stockRecordId)])
  let rows = copiesOf(copies, salesRecordId)
  CheckUtil.expectEqual(stocks.length, rows.length, `${label} 库存流水条数应等于BOM物料数，实际=${stocks.length}，副本=${rows.length}`)
  for (let copy of rows) {
    let stock = stocks.find(row => Number(row.materialId) == Number(copy.materialId))
    CheckUtil.expectEqual(stock != null, true, `${label} 应有物料 ${copy.materialId} 的库存流水`)
    expectStockCnt(stock, {
      cnt: Number(copy.cnt ?? 0) * Number(salesCnt) * -1,
      buyUnitFee: copy.buyUnitFee
    }, `${label} 物料 ${copy.materialId} 的扣减数量`)
  }
}

function expectUntouched(records: any[], variable: any, deleted: boolean) {
  for (let old of variable.originalRows ?? []) {
    if (Number(old.salesRecordId) == Number(variable.updateSalesRecordId)) {
      continue
    }
    if (deleted && hasId(variable.delIds, old.salesRecordId)) {
      CheckUtil.expectEqual(
        records.find(row => Number(row.salesRecordId) == Number(old.salesRecordId)) == null,
        true,
        `已删除的销售记录不应再查出，salesRecordId=${old.salesRecordId}`
      )
      continue
    }
    let row = records.find(item => Number(item.salesRecordId) == Number(old.salesRecordId))
    CheckUtil.expectEqual(row != null, true, `未改动的销售记录应还在，salesRecordId=${old.salesRecordId}`)
    expectCnt(row.cnt, old.cnt, `未改动的数量 salesRecordId=${old.salesRecordId}`)
    expectPrice(row.price, old.price, `未改动的售价 salesRecordId=${old.salesRecordId}`)
    expectPrice(row.money, old.money, `未改动的销售额 salesRecordId=${old.salesRecordId}`)
    expectPrice(row.cost, old.cost, `未改动的成本 salesRecordId=${old.salesRecordId}`)
  }
}

function findAdded(records: any[], variable: any): any {
  return (records ?? []).find(row => {
    return Number(row.productId) == Number(variable.addProductId)
      && toSalesDay(row.salesDate) == variable.salesDay
  })
}

function changedBomsOf(boms: any[]): { boms: any[], materialId: number, cnt: number } {
  CheckUtil.expectEqual((boms ?? []).length > 0, true, '重算前应有当前BOM')
  let rows = (boms ?? []).map(row => {
    let param: any = {
      materialId: row.materialId,
      cnt: row.cnt,
      buyUnitFee: row.buyUnitFee,
      price: row.price,
      stockBuyUnitFee: row.stockBuyUnitFee
    }
    if (row.netCnt != null) {
      param.netCnt = row.netCnt
    }
    if (row.yieldRate != null) {
      param.yieldRate = row.yieldRate
    }
    return param
  })
  let cnt = Number(rows[0].cnt ?? 0) + 1
  rows[0].cnt = cnt
  return {
    boms: rows,
    materialId: Number(rows[0].materialId),
    cnt
  }
}

function prepareDay(result: any): any {
  let records: any[] = result.result?.salesRecord ?? []
  let products: any[] = result.result?.product ?? []
  CheckUtil.expectEqual(records.length > 0, true, '上传后应有销售记录')
  let productMap = mapById(products, 'productId')
  for (let record of records) {
    let product = productMap[Number(record.productId)]
    let productPrice = product?.price == null ? 0 : Number(product.price)
    expectPrice(record.price, productPrice, `上传后售价应等于当时的餐品售价 productId=${record.productId}`)
    expectPrice(
      record.money,
      toNum(Number(record.cnt ?? 0) * Number(record.price ?? 0), 2),
      `上传后销售额应为数量乘售价 productId=${record.productId}`
    )
  }
  let groups: { [day: string]: any[] } = {}
  for (let record of records) {
    let day = toSalesDay(record.salesDate)
    if (groups[day] == null) {
      groups[day] = []
    }
    groups[day].push(record)
  }
  let salesDay = Object.keys(groups).sort((a, b) => {
    let diff = groups[b].length - groups[a].length
    if (diff != 0) {
      return diff
    }
    return a < b ? -1 : 1
  })[0]
  let dayRows = groups[salesDay]
  let seenProduct: { [id: number]: boolean } = {}
  for (let row of dayRows) {
    CheckUtil.expectEqual(seenProduct[Number(row.productId)] != true, true, `当天同一餐品应只有一条销售记录 productId=${row.productId}`)
    seenProduct[Number(row.productId)] = true
  }
  let updateRow = dayRows.find(row => Number(row.noBom) === 0) ?? dayRows[0]
  CheckUtil.expectEqual(Number(updateRow.noBom), 0, '应有带BOM的销售记录，才能校验重算')
  let product = productMap[Number(updateRow.productId)]
  CheckUtil.expectEqual(product != null, true, `要修改的餐品应存在 productId=${updateRow.productId}`)
  let delRow = dayRows.find(row => Number(row.salesRecordId) != Number(updateRow.salesRecordId))
  let dayProduct: { [id: number]: boolean } = {}
  for (let row of dayRows) {
    dayProduct[Number(row.productId)] = true
  }
  let adds: any[] = []
  let delIds: number[] = []
  let addProductId = null
  let addProductName = ''
  if (delRow != null) {
    delIds = [Number(delRow.salesRecordId)]
    addProductId = Number(delRow.productId)
    addProductName = productMap[addProductId]?.name ?? ''
    adds = [{ productId: addProductId, cnt: ADD_CNT }]
  } else {
    let extra = products.find(row => Number(row.isDel) === 0 && dayProduct[Number(row.productId)] != true)
    if (extra != null) {
      addProductId = Number(extra.productId)
      addProductName = extra.name ?? ''
      adds = [{ productId: addProductId, cnt: ADD_CNT }]
    }
  }
  let updateSalesRecordId = Number(updateRow.salesRecordId)
  let updateProductId = Number(updateRow.productId)
  let oldCnt = Number(updateRow.cnt ?? 0)
  let editCnt = oldCnt + 1
  let batchCnt = oldCnt + 2
  let sums = sumRows(dayRows)
  return {
    salesDay,
    updateSalesRecordId,
    updateProductId,
    updateProductName: product.name ?? '',
    updateScaleName: product.scaleName ?? '',
    oldCnt,
    editCnt,
    batchCnt,
    addProductId,
    addProductName,
    delIds,
    adds,
    dayCnt: sums.dayCnt,
    dayCost: sums.dayCost,
    dayMoney: sums.dayMoney,
    aliveProductCnt: products.filter(row => Number(row.isDel) === 0).length,
    originalRows: records.map(row => ({
      salesRecordId: Number(row.salesRecordId),
      productId: Number(row.productId),
      cnt: Number(row.cnt ?? 0),
      cost: Number(row.cost ?? 0),
      price: Number(row.price ?? 0),
      money: Number(row.money ?? 0),
      salesDay: toSalesDay(row.salesDate)
    })),
    dayRows: dayRows.map(row => ({
      salesRecordId: Number(row.salesRecordId),
      productId: Number(row.productId),
      cnt: Number(row.cnt ?? 0),
      cost: Number(row.cost ?? 0),
      price: Number(row.price ?? 0),
      money: Number(row.money ?? 0)
    })),
    noopUpdates: [{ salesRecordId: updateSalesRecordId, productId: updateProductId, cnt: oldCnt }],
    conflictUpdates: [{ salesRecordId: updateSalesRecordId, productId: updateProductId, cnt: editCnt }],
    conflictDels: [updateSalesRecordId],
    zeroUpdates: [{ salesRecordId: updateSalesRecordId, productId: updateProductId, cnt: 0 }],
    dupUpdates: [{ salesRecordId: updateSalesRecordId, productId: updateProductId, cnt: editCnt }],
    dupAdds: [{ productId: updateProductId, cnt: 1 }],
    existAdds: [{ productId: updateProductId, cnt: 1 }],
    batchUpdates: [{ salesRecordId: updateSalesRecordId, productId: updateProductId, cnt: batchCnt }]
  }
}

function checkDaySum(result: any, variable: any, label: string) {
  let row = result.result ?? {}
  expectCnt(row.cnt, variable.dayCnt, `${label}数量合计`)
  expectPrice(row.cost, variable.dayCost, `${label}成本合计`)
  expectPrice(row.money, variable.dayMoney, `${label}销售额合计`)
}

function checkList(result: any, variable: any, opt: { needRecalProductId?: any, cnt?: number, price?: number, money?: number }) {
  let content: any[] = result.result?.content ?? []
    CheckUtil.expectEqual(content.length >= variable.aliveProductCnt, true, `餐品列表应包含未删除餐品，实际=${content.length}`)
    let seen: { [id: number]: any } = {}
    for (let row of content) {
      seen[Number(row.productId)] = row
      CheckUtil.expectEqual(row.unitsName, '份', `${row.name}应返回单位`)
      CheckUtil.expectEqual(
        row.scaleName == '大份' || row.scaleName == '中份',
        true,
        `${row.name}的规格应为大份或中份，实际=${row.scaleName}`
      )
    let expected = (variable.dayRows ?? []).find(item => Number(item.productId) == Number(row.productId))
    if (Number(row.productId) == Number(opt.needRecalProductId)) {
      CheckUtil.expectEqual(row.salesRecord != null, true, `${row.name} 应回填销售记录`)
      CheckUtil.expectEqual(row.needRecalBom, true, `${row.name} 修改BOM后应需要重算`)
      expectCnt(row.salesRecord?.cnt, opt.cnt, `${row.name} 列表数量`)
      expectPrice(row.salesRecord?.price, opt.price, `${row.name} 列表售价`)
      expectPrice(row.salesRecord?.money, opt.money, `${row.name} 列表销售额`)
      continue
    }
    if (expected == null) {
      CheckUtil.expectEqual(row.needRecalBom, false, `${row.name} 当天没有要重算的销售`)
      CheckUtil.expectEqual(row.salesRecord == null, true, `${row.name} 当天没有销售`)
      continue
    }
    CheckUtil.expectEqual(row.salesRecord != null, true, `${row.name} 应回填销售记录`)
    CheckUtil.expectEqual(row.needRecalBom, false, `${row.name} 此时不应重算BOM`)
    expectCnt(row.salesRecord.cnt, expected.cnt, `${row.name} 列表数量`)
    expectPrice(row.salesRecord.price, expected.price, `${row.name} 列表售价`)
    expectPrice(row.salesRecord.money, expected.money, `${row.name} 列表销售额`)
    expectPrice(row.salesRecord.cost, expected.cost, `${row.name} 列表成本应取销售记录`)
  }
  for (let expected of variable.dayRows ?? []) {
    CheckUtil.expectEqual(seen[expected.productId] != null, true, `列表应包含当天有销量的餐品 productId=${expected.productId}`)
  }
}

function batchError(name: string, param: any, text: string): BaseTest {
  return new Action({
    name,
    url: '/app/salesRecord/batchSave',
    exceptHttpStatus: 500,
    param: {
      ...warehouseParam(),
      ...param
    }
  }, {
    check(result) {
      let message = errorMessage(result)
      CheckUtil.expectEqual(message.indexOf(text) >= 0, true, `应提示${text}，实际=${message}`)
    }
  })
}

function buildDayActions(variable: any): BaseTest[] {
  return [
    new Action({
      name: '核对上传后的售价和销售额',
      url: '/free/query',
      param: {
        array: [
          {
            table: 'salesRecord',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          },
          {
            table: 'product',
            query: {
              warehouseGroupId: '${warehouse.warehouseGroupId}'
            }
          }
        ]
      }
    }, {
      check(result) {
        prepareDay(result)
      },
      buildVariable(result) {
        return prepareDay(result)
      }
    }).setHighlight(),

    new Action({
      name: '没有销售的日期合计为0',
      url: '/app/salesRecord/getSalesDay',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        salesDay: '1999-01-01'
      }
    }, {
      check(result) {
        expectCnt(result.result?.cnt, 0, '空日期数量')
        expectPrice(result.result?.cost, 0, '空日期成本')
        expectPrice(result.result?.money, 0, '空日期销售额')
      }
    }),

    new Action({
      name: '查询当天销售合计',
      url: '/app/salesRecord/getSalesDay',
      param: warehouseParam()
    }, {
      check(result) {
        checkDaySum(result, variable, '上传后')
      }
    }).setHighlight(),

    new Action({
      name: '查询填写销售用的餐品列表',
      url: '/app/salesRecord/listProduct4SalesRecord',
      param: warehouseParam()
    }, {
      check(result) {
        checkList(result, variable, {})
      }
    }).setHighlight(),

    new Action({
      name: '空批量保存',
      url: '/app/salesRecord/batchSave',
      param: {
        ...warehouseParam(),
        add: [],
        update: [],
        dels: []
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(Number(result.result?.cnt), 0, '没有变化时返回条数应为0')
      }
    }),

    new Action({
      name: '数量没变时不保存',
      url: '/app/salesRecord/batchSave',
      param: {
        ...warehouseParam(),
        add: [],
        update: '${noopUpdates}',
        dels: []
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(Number(result.result?.cnt), 0, '数量相同不应计入修改条数')
      }
    }),

    new Action({
      name: '数量没变后合计仍是原值',
      url: '/app/salesRecord/getSalesDay',
      param: warehouseParam()
    }, {
      check(result) {
        checkDaySum(result, variable, '数量未改时')
      }
    }),

    batchError('同一条记录不能同时修改和删除', {
      add: [],
      update: '${conflictUpdates}',
      dels: '${conflictDels}'
    }, '同一条销售记录不能同时修改和删除'),

    batchError('数量为0不能保存', {
      add: [],
      update: '${zeroUpdates}',
      dels: []
    }, '销售数量须大于 0'),

    batchError('同一餐品不能同时新增和修改', {
      add: '${dupAdds}',
      update: '${dupUpdates}',
      dels: []
    }, '餐品重复'),

    batchError('已有销售的餐品不能再新增', {
      add: '${existAdds}',
      update: [],
      dels: []
    }, '该餐品当天已有销售记录'),

    new Action({
      name: '异常批量保存后合计不变',
      url: '/app/salesRecord/getSalesDay',
      param: warehouseParam()
    }, {
      check(result) {
        checkDaySum(result, variable, '异常保存后')
      }
    }),

    new Action({
      name: '修改餐品售价',
      url: '/app/product/updateProduct',
      param: {
        productId: '${updateProductId}',
        name: '${updateProductName}',
        scaleName: '${updateScaleName}',
        price: SALE_PRICE
      }
    }),

    new Action({
      name: '记下改数量前的BOM副本',
      url: '/free/query',
      param: salesPackParam()
    }, {
      buildVariable(result) {
        return {
          copyIds: copyIdText(result.result?.salesRecordBom ?? [], variable.updateSalesRecordId)
        }
      }
    }),

    new Action({
      name: '原有接口修改销售数量',
      url: '/app/salesRecord/updateSalesRecord',
      param: {
        salesRecordId: '${updateSalesRecordId}',
        cnt: '${editCnt}'
      }
    }),

    new Action({
      name: '校验原有修改接口的售价和副本',
      url: '/free/query',
      param: salesPackParam()
    }, {
      check(result) {
        let body = result.result ?? {}
        let records: any[] = body.salesRecord ?? []
        let row = records.find(item => Number(item.salesRecordId) == Number(variable.updateSalesRecordId))
        CheckUtil.expectEqual(row != null, true, '修改后应能查到销售记录')
        expectCnt(row.cnt, variable.editCnt, '原有修改接口的数量')
        expectPrice(row.price, SALE_PRICE, '原有修改接口的售价应改为当前餐品售价')
        expectPrice(row.money, toNum(Number(variable.editCnt) * SALE_PRICE, 2), '原有修改接口的销售额')
        expectSalesCost([row], copiesOf(body.salesRecordBom, row.salesRecordId), '原有修改接口')
        CheckUtil.expectEqual(
          copyIdText(body.salesRecordBom, row.salesRecordId),
          variable.copyIds,
          '原有修改接口不应重建BOM副本'
        )
        expectLinkedStock(row.salesRecordId, row.cnt, body.salesRecordBom, body.salesStock, body.stockRecord, '原有修改接口')
        expectUntouched(records, variable, false)
      },
      buildVariable(result) {
        let records = (result.result?.salesRecord ?? []).filter(row => toSalesDay(row.salesDate) == variable.salesDay)
        return sumRows(records)
      }
    }).setHighlight(),

    new Action({
      name: '原有修改后的当天合计',
      url: '/app/salesRecord/getSalesDay',
      param: warehouseParam()
    }, {
      check(result) {
        checkDaySum(result, variable, '原有修改后')
      }
    }),

    new Action({
      name: '批量保存销售记录',
      url: '/app/salesRecord/batchSave',
      param: {
        ...warehouseParam(),
        add: '${adds}',
        update: '${batchUpdates}',
        dels: '${delIds}'
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(
          Number(result.result?.cnt),
          1 + (variable.delIds ?? []).length + (variable.adds ?? []).length,
          '批量保存应计入实际新增、修改、删除的条数'
        )
      }
    }),

    new Action({
      name: '校验批量保存后的售价、数量和库存',
      url: '/free/query',
      param: salesPackParam()
    }, {
      check(result) {
        let body = result.result ?? {}
        let records: any[] = body.salesRecord ?? []
        let row = records.find(item => Number(item.salesRecordId) == Number(variable.updateSalesRecordId))
        CheckUtil.expectEqual(row != null, true, '批量修改的销售记录应还在')
        expectCnt(row.cnt, variable.batchCnt, '批量修改后的数量')
        expectPrice(row.price, SALE_PRICE, '批量修改后的售价')
        expectPrice(row.money, toNum(Number(variable.batchCnt) * SALE_PRICE, 2), '批量修改后的销售额')
        expectSalesCost([row], copiesOf(body.salesRecordBom, row.salesRecordId), '批量修改')
        CheckUtil.expectEqual(
          copyIdText(body.salesRecordBom, row.salesRecordId),
          variable.copyIds,
          '批量修改数量不应重建BOM副本'
        )
        expectLinkedStock(row.salesRecordId, row.cnt, body.salesRecordBom, body.salesStock, body.stockRecord, '批量修改')
        if ((variable.adds ?? []).length > 0) {
          let added = findAdded(records, variable)
          CheckUtil.expectEqual(added != null, true, `应新增${variable.addProductName}的销售记录`)
          expectCnt(added.cnt, ADD_CNT, '批量新增的数量')
          let addProduct = mapById(body.product, 'productId')[Number(variable.addProductId)]
          let addPrice = addProduct?.price == null ? 0 : Number(addProduct.price)
          expectPrice(added.price, addPrice, '批量新增的售价应取当前餐品售价')
          expectPrice(added.money, toNum(ADD_CNT * addPrice, 2), '批量新增的销售额')
          expectSalesCost([added], copiesOf(body.salesRecordBom, added.salesRecordId), '批量新增')
          expectLinkedStock(added.salesRecordId, added.cnt, body.salesRecordBom, body.salesStock, body.stockRecord, '批量新增')
        }
        expectUntouched(records, variable, true)
        expectSalesCost(records, body.salesRecordBom ?? [], '批量保存后')
      },
      buildVariable(result) {
        let body = result.result ?? {}
        let records = (body.salesRecord ?? []).filter(row => toSalesDay(row.salesDate) == variable.salesDay)
        let changed = changedBomsOf(body.bom ?? [])
        let added = findAdded(body.salesRecord ?? [], variable)
        return {
          ...sumRows(records),
          dayRows: records.map(row => ({
            salesRecordId: Number(row.salesRecordId),
            productId: Number(row.productId),
            cnt: Number(row.cnt ?? 0),
            cost: Number(row.cost ?? 0),
            price: Number(row.price ?? 0),
            money: Number(row.money ?? 0)
          })),
          changedBoms: changed.boms,
          changedMaterialId: changed.materialId,
          changedBomCnt: changed.cnt,
          addedSalesRecordId: added?.salesRecordId ?? 0
        }
      }
    }).setHighlight(),

    new Action({
      name: '批量保存后的当天合计',
      url: '/app/salesRecord/getSalesDay',
      param: warehouseParam()
    }, {
      check(result) {
        checkDaySum(result, variable, '批量保存后')
      }
    }),

    new Action({
      name: '修改当前BOM',
      url: '/app/bom/saveBom',
      param: {
        productId: '${updateProductId}',
        boms: '${changedBoms}'
      }
    }),

    new Action({
      name: 'BOM变化后列表标出需要重算',
      url: '/app/salesRecord/listProduct4SalesRecord',
      param: warehouseParam()
    }, {
      check(result) {
        let money = toNum(Number(variable.batchCnt) * SALE_PRICE, 2)
        checkList(result, variable, {
          needRecalProductId: variable.updateProductId,
          cnt: variable.batchCnt,
          price: SALE_PRICE,
          money
        })
      }
    }).setHighlight(),

    new Action({
      name: '按当前BOM重算',
      url: '/app/salesRecord/recalBom',
      param: {
        ...warehouseParam(),
        productId: '${updateProductId}'
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(Number(result.result?.cnt), 1, '只有BOM已变化的这一条应重算')
      }
    }),

    new Action({
      name: '校验重算后的成本、售价和库存',
      url: '/free/query',
      param: salesPackParam()
    }, {
      check(result) {
        let body = result.result ?? {}
        let records: any[] = body.salesRecord ?? []
        let row = records.find(item => Number(item.salesRecordId) == Number(variable.updateSalesRecordId))
        CheckUtil.expectEqual(row != null, true, '重算后销售记录应还在')
        expectCnt(row.cnt, variable.batchCnt, '重算不应改数量')
        expectPrice(row.price, SALE_PRICE, '重算不应改售价')
        expectPrice(row.money, toNum(Number(variable.batchCnt) * SALE_PRICE, 2), '重算不应改销售额')
        let copies = copiesOf(body.salesRecordBom, row.salesRecordId)
        expectSalesCost([row], copies, '重算后')
        CheckUtil.expectEqual(copyIdText(body.salesRecordBom, row.salesRecordId) == variable.copyIds, false, '重算应覆盖BOM副本')
        let changed = copies.find(item => Number(item.materialId) == Number(variable.changedMaterialId))
        CheckUtil.expectEqual(changed != null, true, '重算后的副本应包含被修改的物料')
        expectCnt(changed.cnt, variable.changedBomCnt, '重算后的物料用量')
        expectLinkedStock(row.salesRecordId, row.cnt, body.salesRecordBom, body.salesStock, body.stockRecord, '重算后')
        expectPrice(row.price, SALE_PRICE, '重算后售价仍是修改时的售价')
      },
      buildVariable(result) {
        let records = (result.result?.salesRecord ?? []).filter(row => toSalesDay(row.salesDate) == variable.salesDay)
        return sumRows(records)
      }
    }).setHighlight(),

    new Action({
      name: '重算后不再标需要重算',
      url: '/app/salesRecord/listProduct4SalesRecord',
      param: warehouseParam()
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        let row = content.find(item => Number(item.productId) == Number(variable.updateProductId))
        CheckUtil.expectEqual(row != null, true, '重算后列表仍应有该餐品')
        CheckUtil.expectEqual(row.needRecalBom, false, 'BOM已经一致，不应再标重算')
        expectPrice(row.salesRecord?.price, SALE_PRICE, '列表售价在重算后不变')
        expectPrice(row.salesRecord?.money, toNum(Number(variable.batchCnt) * SALE_PRICE, 2), '列表销售额在重算后不变')
        expectCnt(row.salesRecord?.cnt, variable.batchCnt, '列表数量在重算后不变')
      }
    }),

    new Action({
      name: '相同BOM再重算',
      url: '/app/salesRecord/recalBom',
      param: {
        ...warehouseParam(),
        productId: '${updateProductId}'
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(Number(result.result?.cnt), 0, 'BOM相同时不应重算')
      }
    }),

    new Action({
      name: '重算后的当天合计',
      url: '/app/salesRecord/getSalesDay',
      param: warehouseParam()
    }, {
      check(result) {
        checkDaySum(result, variable, '重算后')
      }
    }),

    new Action({
      name: '原有新增接口覆盖同一天的销售',
      url: '/app/salesRecord/addSalesRecord',
      param: {
        productId: '${updateProductId}',
        cnt: OVERWRITE_CNT,
        salesDate: '${salesDay}',
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        let exists = result.result?.exists
        CheckUtil.expectEqual(exists != null, true, '同一天同一餐品应覆盖原记录并返回该记录')
        expectCnt(exists?.cnt, OVERWRITE_CNT, '覆盖后的数量')
        expectPrice(exists?.price, SALE_PRICE, '覆盖后的售价')
        expectPrice(exists?.money, toNum(OVERWRITE_CNT * SALE_PRICE, 2), '覆盖后的销售额')
      }
    }).setHighlight(),

    new Action({
      name: '校验覆盖后的售价、副本和库存',
      url: '/free/query',
      param: salesPackParam()
    }, {
      check(result) {
        let body = result.result ?? {}
        let records: any[] = body.salesRecord ?? []
        let row = records.find(item => Number(item.salesRecordId) == Number(variable.updateSalesRecordId))
        CheckUtil.expectEqual(row != null, true, '覆盖后仍是原来的销售记录')
        expectCnt(row.cnt, OVERWRITE_CNT, '覆盖后库里的数量')
        expectPrice(row.price, SALE_PRICE, '覆盖后库里的售价')
        expectPrice(row.money, toNum(OVERWRITE_CNT * SALE_PRICE, 2), '覆盖后库里的销售额')
        let copies = copiesOf(body.salesRecordBom, row.salesRecordId)
        expectSalesCost([row], copies, '覆盖后')
        let changed = copies.find(item => Number(item.materialId) == Number(variable.changedMaterialId))
        CheckUtil.expectEqual(changed != null, true, '覆盖后应按当前BOM重写副本')
        expectCnt(changed.cnt, variable.changedBomCnt, '覆盖后的物料用量')
        expectLinkedStock(row.salesRecordId, row.cnt, body.salesRecordBom, body.salesStock, body.stockRecord, '覆盖后')
        let sameDay = records.filter(item => {
          return Number(item.productId) == Number(variable.updateProductId) && toSalesDay(item.salesDate) == variable.salesDay
        })
        CheckUtil.expectEqual(sameDay.length, 1, '同一天同一餐品只能有一条销售记录')
      },
      buildVariable(result) {
        let records = (result.result?.salesRecord ?? []).filter(row => toSalesDay(row.salesDate) == variable.salesDay)
        return sumRows(records)
      }
    }).setHighlight(),

    new Action({
      name: '覆盖后的当天合计',
      url: '/app/salesRecord/getSalesDay',
      param: warehouseParam()
    }, {
      check(result) {
        checkDaySum(result, variable, '覆盖后')
      }
    })
  ]
}
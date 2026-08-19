import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import Recal from "../../action/Recal";

const URL = '/app/stockRecord/listStockRecord4Inventory';

/**
 * 盘点历史 listStockRecord4Inventory（见同目录 FlowListStockRecord4Inventory.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '盘点历史：只返回当前盘点之前的流水，消耗单挂 otherType，字段按客户端裁剪' })
  }

  getName(): string {
    return '盘点历史流水'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        remark: '前置：仓库/供应商/物料'
      }),

      new Action({
        name: '5月1日盘点牛肉10斤',
        remark: 'setInventoryByArray：牛肉 10 斤 100 元',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-05-01',
          array: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 10,
            buyUnitFee: 1,
            cost: 100
          }]
        }
      }),

      new PrepOtherUseJune1(),

      new Action({
        name: '7月1日盘点牛肉20斤',
        remark: '当前正在查看的盘点，历史接口应排除本条',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-07-01',
          array: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 20,
            buyUnitFee: 1,
            cost: 200
          }]
        }
      }),

      new Recal().setRemark('盘点与消耗入账后重算，写入 afterStocks/changeCnt'),

      new Action({
        name: '查询7月1日盘点id',
        remark: '按 inventoryDay 取出 7/1 牛肉盘点的 inventoryId',
        url: '/free/query',
        param: {
          array: [{
            table: 'inventory',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              materialId: '${materialMap.牛肉.materialId}',
              isDel: 0
            }
          }]
        }
      }, {
        buildVariable(result) {
          const list = result?.result?.inventory ?? []
          const inv = list.find((row: any) => String(row.inventoryDay).indexOf('2026-07-01') >= 0)
          CheckUtil.expectEqual(inv != null, true, `应有7月1日盘点，实际=${JSON.stringify(list)}`)
          return { inventoryId: inv.inventoryId }
        }
      }),

      new Action({
        name: '查询盘点历史',
        remark: 'listStockRecord4Inventory：应含 5/1 盘点与 6/1 报损，不含 7/1 本盘；报损挂 otherType.name',
        url: URL,
        param: {
          warehouseId: '${warehouse.warehouseId}',
          materialId: '${materialMap.牛肉.materialId}',
          inventoryId: '${inventoryId}'
        }
      }, {
        check(result) {
          checkHistory(result)
        }
      }),

      new Action({
        name: '按日期筛选盘点历史',
        remark: 'cdts.bussinessDate=2026-05-01，应只剩 5/1 盘点流水',
        url: URL,
        param: {
          warehouseId: '${warehouse.warehouseId}',
          materialId: '${materialMap.牛肉.materialId}',
          inventoryId: '${inventoryId}',
          cdts: {
            array: [{ col: 'bussinessDate', value: '2026-05-01' }]
          }
        }
      }, {
        check(result) {
          const content = result?.result?.content ?? []
          CheckUtil.expectEqual(content.length, 1, `按5月1日筛选应1条，实际=${JSON.stringify(content)}`)
          CheckUtil.expectEqual(content[0].type, 'Inventory', `筛选结果应为盘点，实际=${content[0]?.type}`)
          CheckUtil.expectEqual(content[0].cnt, 10, `筛选盘点数量应为10，实际=${content[0]?.cnt}`)
        }
      })
    ]
  }
}

/** listOtherType → saveOtherUse 报损牛肉 1 斤（6月1日） */
class PrepOtherUseJune1 extends TestCase {
  constructor() {
    super({ remark: '新增6月1日报损：牛肉 1 斤' })
  }

  getName(): string {
    return '新增6月1日消耗'
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
          const content = result.result.content ?? []
          return {
            otherTypeMap: ArrayUtil.toMapByKey(content, 'name', 'otherTypeId')
          }
        }
      }),

      new Action({
        name: '保存其他消耗',
        remark: '报损：牛肉 1 斤，业务日 2026-06-01',
        url: '/app/otherUse/saveOtherUse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherTypeMap.报损}',
          remark: '盘点历史报损',
          createTime: '2026-06-01',
          otherItems: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 1,
            buyUnitFee: 1
          }]
        }
      })
    ]
  }
}

const KEEP_KEYS = [
  'stockRecordId',
  'bussinessDate',
  'sysAddTime',
  'cnt',
  'buyUnitFee',
  'cost',
  'type',
  'name',
  'unitsId',
  'stockUnitsId',
  'buyUnit',
  'userOfModify',
  'inventoryStalls',
  'otherUse'
]

const DROP_KEYS = [
  'afterStocks',
  'changeCnt',
  'warehouseId',
  'warehouseGroupId',
  'noteItemId',
  'noteItemType',
  'calType',
  'isDel',
  'contextId',
  'addUser',
  'modifyUser',
  'stockId',
  'supplierId',
  'cntOfChange',
  'costOfChange',
  'userOfAdd',
  'pinyin',
  'firstPinyin',
  'code',
  'categoryId',
  'buyUnitId',
  'price'
]

function checkHistory(result: any) {
  const content = result?.result?.content ?? []
  CheckUtil.expectEqual(content.length, 2, `历史应有盘点+消耗共2条，实际=${JSON.stringify(content)}`)

  const inventoryRow = content.find((row: any) => row.type === 'Inventory')
  const otherUseRow = content.find((row: any) => row.type === 'otherUse')
  CheckUtil.expectEqual(inventoryRow != null, true, `应有盘点流水，实际=${JSON.stringify(content)}`)
  CheckUtil.expectEqual(otherUseRow != null, true, `应有其他消耗流水，实际=${JSON.stringify(content)}`)

  CheckUtil.expectEqual(inventoryRow.cnt, 10, `5/1盘点数量应为10，实际=${inventoryRow.cnt}`)
  CheckUtil.expectEqual(inventoryRow.cost, 100, `5/1盘点金额应为100，实际=${inventoryRow.cost}`)
  CheckUtil.expectEqual(String(inventoryRow.bussinessDate).indexOf('2026-05-01') >= 0, true,
    `盘点业务日应含2026-05-01，实际=${inventoryRow.bussinessDate}`)

  CheckUtil.expectEqual(otherUseRow.otherUse?.otherType?.name, '报损',
    `消耗类型应为报损，实际=${JSON.stringify(otherUseRow.otherUse)}`)
  CheckUtil.expectEqual(String(otherUseRow.bussinessDate).indexOf('2026-06-01') >= 0, true,
    `消耗业务日应含2026-06-01，实际=${otherUseRow.bussinessDate}`)

  CheckUtil.expectEqual(content.some((row: any) => row.cnt === 20), false,
    `不应包含7/1本盘点，实际=${JSON.stringify(content)}`)

  for (const row of content) {
    CheckUtil.expectEqual(row.stockRecordId != null, true, `应有 stockRecordId，row=${JSON.stringify(row)}`)
    CheckUtil.expectEqual(row.name, '牛肉', `物料名应为牛肉，实际=${row.name}`)
    CheckUtil.expectEqual(row.buyUnit != null && row.buyUnit.length > 0, true, `应有 buyUnit，row=${JSON.stringify(row)}`)
    CheckUtil.expectEqual(row.userOfModify?.name != null && row.userOfModify.name !== '', true,
      `应有操作人 userOfModify.name，row=${JSON.stringify(row)}`)
    CheckUtil.expectEqual(row.sysAddTime != null, true, `应有 sysAddTime，row=${JSON.stringify(row)}`)
    for (const key of DROP_KEYS) {
      CheckUtil.expectEqual(row[key] == null, true, `冗余字段 ${key} 不应返回，row=${JSON.stringify(row)}`)
    }
    for (const key of Object.keys(row)) {
      CheckUtil.expectEqual(
        KEEP_KEYS.indexOf(key) >= 0,
        true,
        `多余字段 ${key} 不应返回，row=${JSON.stringify(row)}`
      )
    }
  }
}

import { BaseTest, CheckUtil, DateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import Recal from "../../action/Recal";

const JUNE_DAY = '2026-06-01'
const JULY_DAY = '2026-07-01'
const LIST_DAY = '/app/inventory/listInventoryDay'
const LIST_NEW = '/app/inventory/listNewInventory'

/**
 * listNewInventory / listInventoryDay：7/1 与当天用 addInventory 加入羊肉+牛肉，
 * 只填牛肉数量；6/1 羊/猪入库。见同目录 FlowListNewInventory.md。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '6/1入库羊猪；7/1与当天createInventory羊牛，只盘牛肉；再Recal' })
  }

  getName(): string {
    return '盘点物料列表init'
  }

  protected buildActions(): BaseTest[] {
    const today = DateUtil.todayStr()
    return [
      new PreTest({
        remark: '前置：仓库/供应商；羊牛猪初始单位包',
        materialsOpts: [
          { name: '羊肉', category: '肉类', unit: '包' },
          { name: '牛肉', category: '肉类', unit: '包' },
          { name: '猪肉', category: '肉类', unit: '包' }
        ]
      }),

      new Action({
        name: '6月1日入库羊肉猪肉各2包',
        remark: 'createHandInstock：羊肉2包、猪肉2包，salesDay=2026-06-01',
        url: '/app/note/createHandInstock',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          salesDay: JUNE_DAY,
          items: [
            handItem('羊肉', 2),
            handItem('猪肉', 2)
          ]
        }
      }),

      new PrepCreateInventory({
        targetDay: JULY_DAY,
        today,
        beefCnt: 1,
        remark: '7/1：addInventory羊肉+牛肉，牛肉盘1包，再改日期到7/1'
      }),

      new PrepCreateInventory({
        targetDay: today,
        today,
        beefCnt: 0.5,
        remark: '当天：addInventory羊肉+牛肉，牛肉盘0.5包'
      }),

      new Recal().setRemark('盘点与入库入账后重算'),

      new CheckDayList({
        day: JULY_DAY,
        beefCnt: 1,
        label: '7月1日',
        downloadInitCnt: 2,
        remark: '校验7/1：选择2实际1；界面羊肉空、牛肉1包；下载羊肉填6/1入库库存2包'
      }),

      new CheckDayList({
        day: today,
        beefCnt: 0.5,
        label: '当天',
        downloadInitCnt: null,
        checkAllMaterials: true,
        remark: '校验当天：选择2实际1；界面羊肉空、牛肉0.5包；下载未盘点数量列为空'
      }),
    ]
  }
}

/** createInventory 只能写当天；指定羊+牛走 addInventory，再填牛肉数量；非当天则改日期 */
class PrepCreateInventory extends TestCase {
  private opt: {
    targetDay: string
    today: string
    beefCnt: number
    remark: string
  }

  constructor(opt: PrepCreateInventory['opt']) {
    super({ remark: opt.remark })
    this.opt = opt
  }

  getName(): string {
    return `${this.opt.targetDay}createInventory`
  }

  protected buildActions(): BaseTest[] {
    const opt = this.opt
    const ret: BaseTest[] = [
      new Action({
        name: `${opt.targetDay}createInventory羊肉牛肉`,
        remark: 'addInventory：加入羊肉、牛肉（createInventory 按 type 无法只选这两样）',
        url: '/app/inventory/addInventory',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          materialIds: [
            '${materialMap.羊肉.materialId}',
            '${materialMap.牛肉.materialId}'
          ]
        }
      }),
      new Action({
        name: `${opt.targetDay}设置牛肉盘点${opt.beefCnt}包`,
        remark: `setInventoryToInfo：牛肉 cnt=${opt.beefCnt}, buyUnitFee=1`,
        url: '/app/stallMaterialInfo/setInventoryToInfo',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          stock: {
            cnt: opt.beefCnt,
            buyUnitFee: 1,
            materialId: '${materialMap.牛肉.materialId}'
          }
        }
      }),
      new Action({
        name: `${opt.targetDay}保存牛肉盘点`,
        remark: 'setInventoryFromInfo：把已填的牛肉写成 finished',
        url: '/app/inventory/setInventoryFromInfo',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          materialIds: ['${materialMap.牛肉.materialId}']
        }
      }),
      new Action({
        name: `查询当天羊肉盘点id`,
        remark: 'free/query 取当天羊肉 inventoryId，写成 init',
        url: '/free/query',
        param: {
          array: [{
            table: 'inventory',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              materialId: '${materialMap.羊肉.materialId}',
              isDel: 0
            }
          }]
        }
      }, {
        buildVariable(result) {
          const list = result?.result?.inventory ?? []
          const inv = list.find((row: any) => String(row.inventoryDay).indexOf(opt.today) >= 0)
          CheckUtil.expectEqual(inv != null, true, `当天应有羊肉盘点，实际=${JSON.stringify(list)}`)
          return { initInventoryId: inv.inventoryId }
        }
      }),
      new Action({
        name: `${opt.targetDay}羊肉改为未盘点`,
        remark: '/free/update status=init（addInventory 未写 status）',
        url: '/free/update',
        param: {
          table: 'inventory',
          cdts: [
            { col: 'inventoryId', val: '${initInventoryId}' }
          ],
          data: { status: 'init' }
        }
      })
    ]
    if (opt.targetDay !== opt.today) {
      ret.push(new Action({
        name: `盘点日期改为${opt.targetDay}`,
        remark: `changeInventoryTime：${opt.today} → ${opt.targetDay}（createInventory 只能写当天）`,
        url: '/app/inventory/changeInventoryTime',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          inventoryDay: opt.today,
          newInventoryDay: opt.targetDay
        }
      }))
    }
    return ret
  }
}

class CheckDayList extends TestCase {
  private opt: {
    day: string
    beefCnt: number
    label: string
    /** 下载里未盘点行数量：历史填库存；当天为 null 表示应空 */
    downloadInitCnt: number | null
    checkAllMaterials?: boolean
    remark: string
  }

  constructor(opt: CheckDayList['opt']) {
    super({ remark: opt.remark })
    this.opt = opt
  }

  getName(): string {
    return `校验${this.opt.label}盘点`
  }

  protected buildActions(): BaseTest[] {
    const opt = this.opt
    const ret: BaseTest[] = [
      new Action({
        name: `${opt.label}日期列表`,
        remark: `listInventoryDay：${opt.day} 选择2、实际1（未盘点=1）`,
        url: LIST_DAY,
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        check(result) {
          const row = findDay(result, opt.day)
          CheckUtil.expectEqual(row.cnt, 2, `${opt.label}选择物料数应为2，实际=${row.cnt}`)
          CheckUtil.expectEqual(row.finishedCnt, 1, `${opt.label}实际盘点数应为1，实际=${row.finishedCnt}`)
        }
      }),
      new Action({
        name: `${opt.label}界面listNewInventory`,
        remark: `不传isAll：牛肉已盘${opt.beefCnt}包，羊肉init且inventory为空`,
        url: LIST_NEW,
        param: {
          warehouseId: '${warehouse.warehouseId}',
          value: opt.day
        }
      }, {
        check(result) {
          const content = getContent(result)
          CheckUtil.expectEqual(content.length, 2, `${opt.label}界面应2条，实际=${JSON.stringify(content)}`)
          expectNoPork(content, `${opt.label}界面`)
          const beef = findName(content, '牛肉')
          const yang = findName(content, '羊肉')
          CheckUtil.expectEqual(beef.status, 'finished', `${opt.label}牛肉应为finished，实际=${beef.status}`)
          CheckUtil.expectEqual(yang.status, 'init', `${opt.label}羊肉应为init，实际=${yang.status}`)
          CheckUtil.expectEqual(Number(beef.inventory?.cnt), opt.beefCnt, `${opt.label}界面牛肉数量应为${opt.beefCnt}，实际=${beef.inventory?.cnt}`)
          CheckUtil.expectEqual(isPending(yang), true, `${opt.label}界面羊肉应为未盘点(inventory空)，实际=${JSON.stringify(yang.inventory)}`)
          CheckUtil.expectEqual(isPending(beef), false, `${opt.label}界面牛肉应为已盘点`)
        }
      })
    ]
    ret.push(new Action({
      name: `${opt.label}下载listNewInventory`,
      remark: opt.downloadInitCnt == null
        ? 'isAll=2：当天未盘点数量应空；已盘填盘点数量'
        : `isAll=2：未盘点填库存${opt.downloadInitCnt}；已盘填盘点数量`,
      url: LIST_NEW,
      param: {
        warehouseId: '${warehouse.warehouseId}',
        value: opt.day,
        isAll: 2
      }
    }, {
      check(result) {
        const content = getContent(result)
        CheckUtil.expectEqual(content.length, 2, `${opt.label}下载应2条，实际=${JSON.stringify(content)}`)
        expectNoPork(content, `${opt.label}下载`)
        const beef = findName(content, '牛肉')
        const yang = findName(content, '羊肉')
        CheckUtil.expectEqual(beef.status, 'finished', `${opt.label}下载牛肉应为finished，实际=${beef.status}`)
        CheckUtil.expectEqual(Number(beef.inventory?.cnt), opt.beefCnt, `${opt.label}下载牛肉应填盘点数量${opt.beefCnt}，实际=${beef.inventory?.cnt}`)
        CheckUtil.expectEqual(yang.status, 'init', `${opt.label}下载羊肉应为init，实际=${yang.status}`)
        if (opt.downloadInitCnt == null) {
          CheckUtil.expectEqual(isPending(yang), true, `${opt.label}下载未盘点数量应空，实际=${JSON.stringify(yang.inventory)}`)
        } else {
          CheckUtil.expectEqual(Number(yang.inventory?.cnt), opt.downloadInitCnt, `${opt.label}下载未盘点应填库存${opt.downloadInitCnt}，实际=${yang.inventory?.cnt}`)
        }
      }
    }))
    if (opt.checkAllMaterials) {
      ret.push(new Action({
        name: `${opt.label}下载物料总数`,
        remark: 'isAll=1：当天未盘（含未选进盘点的物料）数量应空，不能是0包',
        url: LIST_NEW,
        param: {
          warehouseId: '${warehouse.warehouseId}',
          value: opt.day,
          isAll: 1
        }
      }, {
        check(result) {
          const content = getContent(result)
          CheckUtil.expectEqual(content.length, 3, `${opt.label}物料总数应为3条，实际=${JSON.stringify(content)}`)
          const beef = findName(content, '牛肉')
          const yang = findName(content, '羊肉')
          const pork = findName(content, '猪肉')
          CheckUtil.expectEqual(beef.status, 'finished', `${opt.label}物料总数牛肉应为finished`)
          CheckUtil.expectEqual(Number(beef.inventory?.cnt), opt.beefCnt, `${opt.label}物料总数牛肉应填盘点数量${opt.beefCnt}`)
          CheckUtil.expectEqual(isPending(yang), true, `${opt.label}物料总数羊肉未盘数量应空，实际=${JSON.stringify(yang.inventory)}`)
          CheckUtil.expectEqual(isPending(pork), true, `${opt.label}物料总数猪肉未盘数量应空，实际=${JSON.stringify(pork.inventory)}`)
        }
      }))
    }
    return ret
  }
}

function handItem(name: string, cnt: number) {
  return {
    materialId: `\${materialMap.${name}.materialId}`,
    supplierId: '${supplierMap.供应商1}',
    cnt,
    buyUnitFee: 1,
    cost: cnt * 10,
    price: 10,
    stockBuyUnitFee: 1
  }
}

function getContent(result: any): any[] {
  return result?.result?.content ?? []
}

function findDay(result: any, day: string): any {
  const content = getContent(result)
  const row = content.find((item: any) => String(item.inventoryDay).indexOf(day) >= 0)
  CheckUtil.expectEqual(row != null, true, `日期列表缺少 ${day}，实际=${JSON.stringify(content)}`)
  return row
}

function findName(content: any[], name: string): any {
  const row = content.find((item: any) => item.name === name)
  CheckUtil.expectEqual(row != null, true, `缺少物料${name}，实际=${JSON.stringify(content)}`)
  return row
}

function expectNoPork(content: any[], label: string): void {
  const pork = content.find((item: any) => item.name === '猪肉')
  CheckUtil.expectEqual(pork == null, true, `${label}不应出现猪肉，实际=${JSON.stringify(content)}`)
}

function isPending(row: any): boolean {
  return row.inventory == null || row.inventory.cnt == null
}

import { BaseTest, CheckUtil, DateUtil, HttpAction, TestCase } from 'testflow'
import FindLastUserId from '../../action/user/FindLastUserId'
import LoginAdmin from '../../action/adminUser/LoginAdmin'

const MAX_TOP = 5
const TIME_RE = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/
const KEYS = ['warehouse', 'note', 'users', 'inventory', 'purcharse', 'send']

function storeName(openid: string) {
  return `dash餐厅${openid}`
}
function supplierName(openid: string) {
  return `dash供应商${openid}`
}
function skipWarehouseName(openid: string) {
  return `_testskip${openid}`
}
function delWarehouseName(openid: string) {
  return `dash删${openid}`
}
function atestName(openid: string) {
  return `atest${openid}`
}
function countedUser(openid: string) {
  return `dash${openid}`
}
function skipUser(openid: string) {
  return `_testskip${openid}`
}
function delUser(openid: string) {
  return `dashdel${openid}`
}

function lastMonthFirst(): string {
  return DateUtil.format(DateUtil.beforeMonth(DateUtil.monthFirst(), 1))
}

function dayBefore(day: string): string {
  return DateUtil.format(DateUtil.beforeDay(DateUtil.parse(day), 1))
}

function contentOf(result: any): any[] {
  return result.result?.content ?? []
}

function rowOf(content: any[], key: string) {
  return content.find(row => row.key === key)
}

function valueOf(array: any[], name: string): number {
  let item = (array ?? []).find(row => row.name === name)
  if (item == null) {
    throw new Error(`缺少${name}`)
  }
  return Number(item.value)
}

function timeOf(remark: string): string {
  let found = String(remark ?? '').match(TIME_RE)
  return found ? found[0] : ''
}

/**
 * 前 10 还不满，或末位 + 1 不超过 MAX_TOP 时，造数应出现在图里。
 * 末位已经很大时只造 1 条，避免一次插入过多。
 */
function planTop(array: any[]): { cnt: number, expectInTop: boolean } {
  if (array == null || array.length < 10) {
    return { cnt: 1, expectInTop: true }
  }
  let need = Number(array[array.length - 1].value) + 1
  if (need <= MAX_TOP) {
    return { cnt: need, expectInTop: true }
  }
  return { cnt: 1, expectInTop: false }
}

function assertSorted(array: any[], title: string) {
  CheckUtil.expectTrue(array.length <= 10)
  for (let i = 1; i < array.length; i++) {
    if (Number(array[i].value) > Number(array[i - 1].value)) {
      throw new Error(`${title}应按数量从高到低`)
    }
  }
}

function assertShape(content: any[]) {
  CheckUtil.expectEqual(content.length, KEYS.length, '当天应有6条统计')
  let time = ''
  for (let i = 0; i < KEYS.length; i++) {
    let row = content[i]
    CheckUtil.expectEqual(row.key, KEYS[i], '统计顺序')
    CheckUtil.expectTrue(row.json == null)
    CheckUtil.expectNotNull(row.jsonData?.array, `${row.key}应有jsonData.array`)
    let remarkTime = timeOf(row.remark)
    CheckUtil.expectTrue(remarkTime !== '')
    if (time === '') {
      time = remarkTime
    }
    CheckUtil.expectEqual(remarkTime, time, '同一轮统计时刻应相同')
  }
  let warehouse = content[0]
  let note = content[1]
  let users = content[2]
  let inventory = content[3]
  let purcharse = content[4]
  let send = content[5]
  CheckUtil.expectEqual(warehouse.type, 'card')
  CheckUtil.expectEqual(note.type, 'card')
  CheckUtil.expectEqual(users.type, 'card')
  CheckUtil.expectEqual(inventory.type, 'bar')
  CheckUtil.expectEqual(purcharse.type, 'bar')
  CheckUtil.expectEqual(send.type, 'bar')
  CheckUtil.expectEqual(warehouse.remark, `截至 ${time} 的全部餐厅与供应商`)
  CheckUtil.expectEqual(note.remark, `截至 ${time}，不含草稿和已删除`)
  CheckUtil.expectEqual(users.remark, `截至 ${time} 的全部用户`)
  CheckUtil.expectEqual(inventory.remark, `${lastMonthFirst()} 至 ${time} 的盘点明细行数前10`)
  CheckUtil.expectEqual(purcharse.remark, `截至 ${time}，订货单数量前10的餐厅`)
  CheckUtil.expectEqual(send.remark, `截至 ${time}，发货单数量前10的供应商`)
  assertSorted(inventory.jsonData.array, '盘点')
  assertSorted(purcharse.jsonData.array, '订货单')
  assertSorted(send.jsonData.array, '发货单')
  return time
}

function noteRow(opt: {
  warehouseId: number
  type: string
  status: string
  isDel: number
  title: string
}) {
  return {
    warehouseId: opt.warehouseId,
    warehouseGroupId: 0,
    supplierId: 0,
    isDel: opt.isDel,
    status: opt.status,
    type: opt.type,
    origin: 'normal',
    title: opt.title,
    materialCnt: 1,
    linkNoteId: 0,
    parenNoteId: 0
  }
}

function repeatNote(opt: {
  warehouseId: number
  type: string
  status: string
  isDel: number
  title: string
  cnt: number
}) {
  let rows = []
  for (let i = 0; i < opt.cnt; i++) {
    rows.push(noteRow(opt))
  }
  return rows
}

/**
 * 运营平台工作台：刷新后按当天查询，用差额校验过滤和前 10。
 * 见同目录 FlowDashboard.md。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '工作台：当天快照、过滤草稿和测试数据、重复刷新软删' })
  }

  getName(): string {
    return '运营平台工作台'
  }

  protected buildActions(): BaseTest[] {
    let variable = this.getVariable()
    variable.token = ''
    return [
      new FindLastUserId(),
      new LoginAdmin(),
      this.refresh('第一次刷新'),
      this.list('记录刷新前的基线', (result) => {
        let content = contentOf(result)
        assertShape(content)
        return {
          dashBase: content,
          dashTime: timeOf(content[0].remark)
        }
      }),
      this.countDeleted('记录已软删条数', 'dashDelCnt'),
      this.addWarehouses(),
      this.addUsers(),
      this.addNotes(),
      this.addInventory(),
      this.refresh('造数后刷新'),
      this.list('校验造数后的差额', (result) => {
        this.assertDelta(contentOf(result), variable)
        return {
          dashTime: timeOf(contentOf(result)[0].remark),
          dashAfter: contentOf(result)
        }
      }),
      this.refresh('再次刷新'),
      this.list('再次刷新后数量不变', (result) => {
        let content = contentOf(result)
        assertShape(content)
        this.assertSameCards(content, variable.dashAfter)
        return {}
      }),
      this.countDeleted('重复刷新应再软删12条', null, (rows) => {
        CheckUtil.expectEqual(rows.length, variable.dashDelCnt + 12, '两次刷新应各软删6条')
      }),
      this.delNotes(),
      this.delInventory(),
      this.delWarehouses(),
      this.delUsers(),
      this.refresh('清理后刷新'),
      this.list('清理后卡片回到基线', (result) => {
        let content = contentOf(result)
        assertShape(content)
        this.assertSameCards(content, variable.dashBase)
        let openid = variable.openid
        for (let key of ['inventory', 'purcharse', 'send']) {
          let names = rowOf(content, key).jsonData.array.map(row => row.name)
          CheckUtil.expectTrue(names.indexOf(storeName(openid)) < 0)
          CheckUtil.expectTrue(names.indexOf(supplierName(openid)) < 0)
        }
        return {}
      })
    ]
  }

  private refresh(name: string) {
    return new HttpAction({
      name,
      url: '/admin/dashboard/refreshDashboard',
      param: {}
    })
  }

  private list(name: string, onList: (result: any) => any) {
    return new HttpAction({
      name,
      url: '/admin/dashboard/listDashboard',
      param: {
        pageSize: 20
      }
    }, {
      buildVariable(result) {
        return onList(result)
      }
    })
  }

  private countDeleted(name: string, key: string, check?: (rows: any[]) => void) {
    return new HttpAction({
      name,
      url: '/free/query',
      param: {
        array: [{
          table: 'dashboard',
          query: {
            day: DateUtil.todayStr(),
            isDel: 1
          }
        }]
      }
    }, {
      buildVariable(result) {
        let rows = result.result?.dashboard ?? []
        if (check) {
          check(rows)
        }
        if (key == null) {
          return {}
        }
        return {
          [key]: rows.length
        }
      }
    })
  }

  private addWarehouses() {
    return new HttpAction({
      name: '插入仓库',
      remark: '两家计入的餐厅、一家供应商；_test 开头和已删除不计入；atest 不是前缀，要计入',
      url: '/free/add',
      param: {
        table: 'warehouse',
        array: []
      }
    }, {
      parseHttpParam(param, variable) {
        let openid = variable.openid
        param.array = [
          { name: storeName(openid), type: 'store', isDel: 0, warehouseGroupId: 0 },
          { name: supplierName(openid), type: 'supplier', isDel: 0, warehouseGroupId: 0 },
          { name: atestName(openid), type: 'store', isDel: 0, warehouseGroupId: 0 },
          { name: skipWarehouseName(openid), type: 'store', isDel: 0, warehouseGroupId: 0 },
          { name: delWarehouseName(openid), type: 'store', isDel: 1, warehouseGroupId: 0 }
        ]
        return param
      },
      buildVariable(result) {
        let rows: any[] = result.result ?? []
        let idBy = (prefix: string) => rows.find(row => String(row.name).startsWith(prefix))?.warehouseId
        return {
          storeId: idBy('dash餐厅'),
          supplierId: idBy('dash供应商'),
          atestId: idBy('atest'),
          skipWarehouseId: idBy('_testskip'),
          delWarehouseId: idBy('dash删')
        }
      }
    })
  }

  private addUsers() {
    return new HttpAction({
      name: '插入用户',
      remark: '只有不是 _test 开头且未删除的用户计入',
      url: '/free/add',
      param: {
        table: 'users',
        array: []
      }
    }, {
      parseHttpParam(param, variable) {
        let openid = variable.openid
        param.array = [
          { openid: countedUser(openid), username: countedUser(openid), isDel: 0, nickName: 'dash' },
          { openid: skipUser(openid), username: skipUser(openid), isDel: 0, nickName: 'dash跳过' },
          { openid: delUser(openid), username: delUser(openid), isDel: 1, nickName: 'dash删除' }
        ]
        return param
      }
    })
  }

  private addNotes() {
    return new HttpAction({
      name: '插入订单',
      remark: '订货单和发货单按仓库计数；草稿和已删除不计入；退货单只进订单总数',
      url: '/free/add',
      param: {
        table: 'note',
        array: []
      }
    }, {
      parseHttpParam(param, variable) {
        let openid = variable.openid
        let base = variable.dashBase
        let pur = planTop(rowOf(base, 'purcharse').jsonData.array)
        let send = planTop(rowOf(base, 'send').jsonData.array)
        variable.purCnt = pur.cnt
        variable.sendCnt = send.cnt
        variable.expectPurInTop = pur.expectInTop
        variable.expectSendInTop = send.expectInTop
        let title = `dash${openid}`
        param.array = [
          ...repeatNote({
            warehouseId: variable.storeId,
            type: 'purcharse',
            status: 'normal',
            isDel: 0,
            title,
            cnt: pur.cnt
          }),
          noteRow({
            warehouseId: variable.storeId,
            type: 'purcharse',
            status: 'init',
            isDel: 0,
            title
          }),
          noteRow({
            warehouseId: variable.storeId,
            type: 'purcharse',
            status: 'normal',
            isDel: 1,
            title
          }),
          noteRow({
            warehouseId: variable.storeId,
            type: 'back',
            status: 'normal',
            isDel: 0,
            title
          }),
          ...repeatNote({
            warehouseId: variable.supplierId,
            type: 'send',
            status: 'normal',
            isDel: 0,
            title,
            cnt: send.cnt
          }),
          noteRow({
            warehouseId: variable.supplierId,
            type: 'send',
            status: 'init',
            isDel: 0,
            title
          }),
          noteRow({
            warehouseId: variable.supplierId,
            type: 'send',
            status: 'normal',
            isDel: 1,
            title
          })
        ]
        return param
      }
    })
  }

  private addInventory() {
    return new HttpAction({
      name: '插入盘点',
      remark: 'finished 且日期在上月1日以后才计入；default、已删除、更早的日期不计入',
      url: '/free/add',
      param: {
        table: 'inventory',
        array: []
      }
    }, {
      parseHttpParam(param, variable) {
        let base = variable.dashBase
        let plan = planTop(rowOf(base, 'inventory').jsonData.array)
        variable.invCnt = plan.cnt
        variable.expectInvInTop = plan.expectInTop
        let begin = lastMonthFirst()
        let rows = []
        for (let i = 0; i < plan.cnt; i++) {
          rows.push({
            warehouseId: variable.storeId,
            warehouseGroupId: 0,
            materialId: i + 1,
            cnt: 1,
            buyUnitFee: 1,
            status: 'finished',
            isDel: 0,
            inventoryDay: i === 0 ? begin : DateUtil.todayStr()
          })
        }
        rows.push({
          warehouseId: variable.storeId,
          warehouseGroupId: 0,
          materialId: 900001,
          cnt: 1,
          buyUnitFee: 1,
          status: 'default',
          isDel: 0,
          inventoryDay: DateUtil.todayStr()
        })
        rows.push({
          warehouseId: variable.storeId,
          warehouseGroupId: 0,
          materialId: 900002,
          cnt: 1,
          buyUnitFee: 1,
          status: 'finished',
          isDel: 1,
          inventoryDay: DateUtil.todayStr()
        })
        rows.push({
          warehouseId: variable.storeId,
          warehouseGroupId: 0,
          materialId: 900003,
          cnt: 1,
          buyUnitFee: 1,
          status: 'finished',
          isDel: 0,
          inventoryDay: dayBefore(begin)
        })
        param.array = rows
        return param
      }
    })
  }

  private delNotes() {
    return new HttpAction({
      name: '删除测试订单',
      url: '/free/del',
      param: {
        table: 'note'
      }
    }, {
      parseHttpParam(param, variable) {
        param.query = {
          warehouseId: [variable.storeId, variable.supplierId]
        }
        return param
      }
    })
  }

  private delInventory() {
    return new HttpAction({
      name: '删除测试盘点',
      url: '/free/del',
      param: {
        table: 'inventory'
      }
    }, {
      parseHttpParam(param, variable) {
        param.query = {
          warehouseId: variable.storeId
        }
        return param
      }
    })
  }

  private delWarehouses() {
    return new HttpAction({
      name: '删除测试仓库',
      url: '/free/del',
      param: {
        table: 'warehouse'
      }
    }, {
      parseHttpParam(param, variable) {
        param.query = {
          warehouseId: [
            variable.storeId,
            variable.supplierId,
            variable.atestId,
            variable.skipWarehouseId,
            variable.delWarehouseId
          ]
        }
        return param
      }
    })
  }

  private delUsers() {
    return new HttpAction({
      name: '删除测试用户',
      url: '/free/del',
      param: {
        table: 'users'
      }
    }, {
      parseHttpParam(param, variable) {
        let openid = variable.openid
        param.query = {
          openid: [countedUser(openid), skipUser(openid), delUser(openid)]
        }
        return param
      }
    })
  }

  private assertDelta(content: any[], variable: any) {
    assertShape(content)
    let base = variable.dashBase
    let openid = variable.openid
    let warehouse = rowOf(content, 'warehouse').jsonData.array
    let baseWarehouse = rowOf(base, 'warehouse').jsonData.array
    CheckUtil.expectEqual(
      valueOf(warehouse, '餐厅') - valueOf(baseWarehouse, '餐厅'),
      2,
      '餐厅应增加 dash餐厅 和 atest'
    )
    CheckUtil.expectEqual(
      valueOf(warehouse, '供应商') - valueOf(baseWarehouse, '供应商'),
      1,
      '供应商应增加 1'
    )
    CheckUtil.expectEqual(
      valueOf(rowOf(content, 'users').jsonData.array, '用户')
        - valueOf(rowOf(base, 'users').jsonData.array, '用户'),
      1,
      '用户应增加 1'
    )
    CheckUtil.expectEqual(
      valueOf(rowOf(content, 'note').jsonData.array, '订单')
        - valueOf(rowOf(base, 'note').jsonData.array, '订单'),
      variable.purCnt + variable.sendCnt + 1,
      '订单总数应含订货单、发货单和退货单'
    )
    this.assertBar(
      rowOf(content, 'purcharse').jsonData.array,
      storeName(openid),
      variable.purCnt,
      variable.expectPurInTop,
      '订货单'
    )
    this.assertBar(
      rowOf(content, 'send').jsonData.array,
      supplierName(openid),
      variable.sendCnt,
      variable.expectSendInTop,
      '发货单'
    )
    this.assertBar(
      rowOf(content, 'inventory').jsonData.array,
      storeName(openid),
      variable.invCnt,
      variable.expectInvInTop,
      '盘点'
    )
  }

  private assertBar(array: any[], name: string, cnt: number, expectInTop: boolean, title: string) {
    assertSorted(array, title)
    let item = array.find(row => row.name === name)
    if (expectInTop) {
      CheckUtil.expectNotNull(item, `${title}应出现${name}`)
      CheckUtil.expectEqual(Number(item.value), cnt, `${title}数量`)
    } else if (item != null) {
      CheckUtil.expectEqual(Number(item.value), cnt, `${title}数量`)
    }
  }

  private assertSameCards(content: any[], previous: any[]) {
    for (let key of ['warehouse', 'note', 'users']) {
      let now = rowOf(content, key).jsonData.array
      let old = rowOf(previous, key).jsonData.array
      for (let item of old) {
        CheckUtil.expectEqual(valueOf(now, item.name), Number(item.value), `${key}.${item.name}`)
      }
    }
  }
}

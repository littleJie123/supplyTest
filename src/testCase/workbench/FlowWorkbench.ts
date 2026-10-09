import { BaseTest, CheckUtil, HttpAction, TestCase } from 'testflow'
import Action from '../../action/Action'
import LoginAdmin from '../../action/adminUser/LoginAdmin'
import FindLastUserId from '../../action/user/FindLastUserId'
import GetOpenId from '../../action/user/GetOpenId'
import ChangeWarehouse from '../../action/user/ChangeWarehouse'
import AddWarehouse from '../../action/warehouse/AddWarehouse'

const ORDER_NAME = '_test_订单'
const STOCK_NAME = '_test_库存'
const CHECK_NAME = '_test_盘点'
const GROUP_ORDER = '订货'
const GROUP_CHECK = '盘点'
const SUPPLIER_NAME = '_test_供应商'
const TYPE_STORE = 'store'
const TYPE_ALL = 'all'
const TYPE_SUPPLIER = 'supplier'
const KEY_NOTE = '_test_note'
const KEY_STOCK = '_test_stock'
const KEY_CHECK = '_test_check'
const KEY_SUPPLIER = '_test_supplier'

const WORKBENCH_KEYS = ['workbenchId', 'name', 'imageKey', 'url', 'routersKey']

/**
 * 系统工作台增删改查、分组顺序、组内顺序，以及用户工作台查询和保存。
 * 见同目录 FlowWorkbench.md。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '工作台：新增不填顺序；分组和组内拖拽顺序；用户查询与保存' })
  }

  getName(): string {
    return '工作台'
  }

  protected buildActions(): BaseTest[] {
    let saved: { orderId?: number, stockId?: number, checkId?: number } = {}
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),
      new SaveUserToken(),
      this.clearTestWorkbench('登录前清理_test_工作台'),
      this.clearTestRouter('登录前清理_test_权限'),
      new LoginAdmin(),
      this.prepareRouters(),
      this.readMaxGroupSort('读取当前最大分组顺序', 'maxGroupSort'),
      this.addFailType(),
      this.addFailRoutersType(),
      this.addWorkbench('新增订单工作台', {
        name: ORDER_NAME,
        imageKey: 'img-order',
        url: '/note',
        groupName: GROUP_ORDER,
        routersKey: KEY_NOTE,
        type: TYPE_STORE
      }, 'orderWorkbenchId', (id) => {
        saved.orderId = id
      }),
      this.listByName('查询订单工作台', ORDER_NAME, {
        imageKey: 'img-order',
        url: '/note',
        groupName: GROUP_ORDER,
        groupSort: (v) => v.maxGroupSort + 1,
        sort: 0,
        routersKey: KEY_NOTE,
        type: TYPE_STORE
      }),
      this.addWorkbench('同名可以再新增订单', {
        name: ORDER_NAME,
        imageKey: 'img-order-dup',
        url: '/note-dup',
        groupName: GROUP_ORDER,
        routersKey: KEY_NOTE,
        type: TYPE_STORE
      }, 'dupOrderWorkbenchId'),
      this.listCount('同名订单可以有两条', ORDER_NAME, 2),
      new HttpAction({
        name: '删除同名的第二条订单',
        url: '/admin/workbench/delWorkbench',
        param: {
          workbenchId: '${dupOrderWorkbenchId}'
        }
      }),
      this.addWorkbench('新增库存工作台', {
        name: STOCK_NAME,
        imageKey: 'img-stock',
        url: '/stock',
        groupName: GROUP_ORDER,
        routersKey: KEY_STOCK,
        type: TYPE_STORE
      }, 'stockWorkbenchId', (id) => {
        saved.stockId = id
      }),
      this.listByName('同组库存沿用分组顺序', STOCK_NAME, {
        imageKey: 'img-stock',
        url: '/stock',
        groupName: GROUP_ORDER,
        groupSort: (v) => v.maxGroupSort + 1,
        sort: 1,
        routersKey: KEY_STOCK,
        type: TYPE_STORE
      }),
      this.addWorkbench('新增盘点工作台', {
        name: CHECK_NAME,
        imageKey: 'img-check',
        url: '/check',
        groupName: GROUP_CHECK,
        routersKey: KEY_CHECK,
        type: TYPE_ALL
      }, 'checkWorkbenchId', (id) => {
        saved.checkId = id
      }),
      this.listByName('新分组盘点取最大分组顺序加1', CHECK_NAME, {
        imageKey: 'img-check',
        url: '/check',
        groupName: GROUP_CHECK,
        groupSort: (v) => v.maxGroupSort + 2,
        sort: 0,
        routersKey: KEY_CHECK,
        type: TYPE_ALL
      }),
      this.updateWorkbench('库存可以改成订单名称', {
        workbenchId: '${stockWorkbenchId}',
        name: ORDER_NAME,
        imageKey: 'img-stock',
        url: '/stock',
        groupName: GROUP_ORDER,
        routersKey: KEY_STOCK,
        type: TYPE_STORE
      }),
      this.listCount('改名后订单名称有两条', ORDER_NAME, 2),
      this.updateWorkbench('库存名称改回', {
        workbenchId: '${stockWorkbenchId}',
        name: STOCK_NAME,
        imageKey: 'img-stock',
        url: '/stock',
        groupName: GROUP_ORDER,
        routersKey: KEY_STOCK,
        type: TYPE_STORE
      }),
      this.updateGroupSort('${orderWorkbenchId}', 4),
      this.updateGroupSort('${stockWorkbenchId}', 8),
      new HttpAction({
        name: '设置订货组内顺序',
        remark: '库存在前，订单在后；全组 groupSort 取 workbenchId 最小且不为空的值',
        url: '/admin/workbench/setSort',
        param: {
          groupName: GROUP_ORDER,
          workbenchIds: ['${stockWorkbenchId}', '${orderWorkbenchId}']
        }
      }),
      this.listByName('库存组内排序为0且分组顺序对齐', STOCK_NAME, {
        imageKey: 'img-stock',
        url: '/stock',
        groupName: GROUP_ORDER,
        groupSort: 4,
        sort: 0,
        routersKey: KEY_STOCK,
        type: TYPE_STORE
      }),
      this.listByName('订单组内排序为1且分组顺序对齐', ORDER_NAME, {
        imageKey: 'img-order',
        url: '/note',
        groupName: GROUP_ORDER,
        groupSort: 4,
        sort: 1,
        routersKey: KEY_NOTE,
        type: TYPE_STORE
      }),
      new HttpAction({
        name: '设置分组顺序',
        remark: '盘点在前，订货在后',
        url: '/admin/workbench/setGroupSort',
        param: {
          groupNames: [GROUP_CHECK, GROUP_ORDER]
        }
      }),
      this.listTestOrder('排序后盘点、库存、订单', [CHECK_NAME, STOCK_NAME, ORDER_NAME]),
      this.updateWorkbench('同组更新不改顺序', {
        workbenchId: '${checkWorkbenchId}',
        name: CHECK_NAME,
        imageKey: 'img-check2',
        url: '/check',
        groupName: GROUP_CHECK,
        routersKey: KEY_CHECK,
        type: TYPE_ALL,
        sort: 99,
        groupSort: 99
      }),
      this.listByName('盘点仍沿用同组顺序', CHECK_NAME, {
        imageKey: 'img-check2',
        url: '/check',
        groupName: GROUP_CHECK,
        groupSort: 0,
        sort: 0,
        routersKey: KEY_CHECK,
        type: TYPE_ALL
      }),
      this.readMaxGroupSort('读取改分组前的最大分组顺序', 'moveMaxGroupSort'),
      this.updateWorkbench('库存改到新分组', {
        workbenchId: '${stockWorkbenchId}',
        name: STOCK_NAME,
        imageKey: 'img-stock',
        url: '/stock',
        groupName: '_test_新组',
        routersKey: KEY_STOCK,
        type: TYPE_STORE,
        sort: 99,
        groupSort: 99
      }),
      this.listByName('新分组取最大分组顺序加1且不改sort', STOCK_NAME, {
        imageKey: 'img-stock',
        url: '/stock',
        groupName: '_test_新组',
        groupSort: (v) => v.moveMaxGroupSort + 1,
        sort: 0,
        routersKey: KEY_STOCK,
        type: TYPE_STORE
      }),
      this.updateWorkbench('库存改回订货分组', {
        workbenchId: '${stockWorkbenchId}',
        name: STOCK_NAME,
        imageKey: 'img-stock',
        url: '/stock',
        groupName: GROUP_ORDER,
        routersKey: KEY_STOCK,
        type: TYPE_STORE
      }),
      this.listByName('改回订货沿用分组顺序', STOCK_NAME, {
        imageKey: 'img-stock',
        url: '/stock',
        groupName: GROUP_ORDER,
        groupSort: 1,
        sort: 0,
        routersKey: KEY_STOCK,
        type: TYPE_STORE
      }),
      new HttpAction({
        name: '删除订单工作台',
        url: '/admin/workbench/delWorkbench',
        param: {
          workbenchId: '${orderWorkbenchId}'
        }
      }),
      this.listByName('删除后查不到订单工作台', ORDER_NAME, null),
      this.addWorkbench('删除后可再用订单名称', {
        name: ORDER_NAME,
        imageKey: 'img-order2',
        url: '/note',
        groupName: GROUP_ORDER,
        routersKey: KEY_NOTE,
        type: TYPE_STORE
      }, 'newOrderWorkbenchId'),
      this.listByName('再次新增沿用订货分组顺序', ORDER_NAME, {
        imageKey: 'img-order2',
        url: '/note',
        groupName: GROUP_ORDER,
        groupSort: 1,
        sort: 1,
        routersKey: KEY_NOTE,
        type: TYPE_STORE
      }),
      this.addWorkbench('新增供应商工作台', {
        name: SUPPLIER_NAME,
        imageKey: 'img-supplier',
        url: '/supplier',
        groupName: '供应',
        routersKey: KEY_SUPPLIER,
        type: TYPE_SUPPLIER
      }, 'supplierWorkbenchId'),
      this.listByType('按门店类型只看到订货', TYPE_STORE, [STOCK_NAME, ORDER_NAME]),
      this.listByType('按全部类型只看到盘点', TYPE_ALL, [CHECK_NAME]),
      this.listByType('按供应商类型只看到供应商', TYPE_SUPPLIER, [SUPPLIER_NAME]),
      this.listTestOrder('不筛选类型时测试数据都在', [CHECK_NAME, STOCK_NAME, ORDER_NAME, SUPPLIER_NAME]),
      new RestoreUserToken(),
      this.getSystem('按门店类型查询系统工作台', (array) => {
        let check = findPlaced(array, CHECK_NAME)
        let stock = findPlaced(array, STOCK_NAME)
        let order = findPlaced(array, ORDER_NAME)
        CheckUtil.expectNotNull(check, '应包含盘点')
        CheckUtil.expectNotNull(stock, '应包含库存')
        CheckUtil.expectNotNull(order, '应包含订单')
        CheckUtil.expectTrue(check.gi < stock.gi)
        CheckUtil.expectEqual(stock.gi, order.gi)
        CheckUtil.expectTrue(stock.ii < order.ii)
        CheckUtil.expectEqual(findPlaced(array, SUPPLIER_NAME) == null, true, '供应商工作台不应返回给门店')
      }),
      this.getUser('无用户配置时按系统顺序分组返回', (array) => {
        let check = findPlaced(array, CHECK_NAME)
        let stock = findPlaced(array, STOCK_NAME)
        let order = findPlaced(array, ORDER_NAME)
        CheckUtil.expectNotNull(check, '应包含盘点')
        CheckUtil.expectNotNull(stock, '应包含库存')
        CheckUtil.expectNotNull(order, '应包含重新新增的订单')
        CheckUtil.expectTrue(check.gi < stock.gi)
        CheckUtil.expectEqual(stock.gi, order.gi)
        CheckUtil.expectTrue(stock.ii < order.ii)
        CheckUtil.expectEqual(findPlaced(array, SUPPLIER_NAME) == null, true, '供应商工作台不应返回给门店')
        CheckUtil.expectEqual(
          array.some(group => (group.items ?? []).some((item: any) => item.workbench?.workbenchId == saved.orderId)),
          false,
          '已删除的系统工作台不应返回'
        )
        assertClientItem(check.item, {
          name: CHECK_NAME,
          imageKey: 'img-check2',
          url: '/check',
          routersKey: KEY_CHECK
        })
        CheckUtil.expectEqual(check.group.groupName, GROUP_CHECK)
      }, true),
      this.saveUser('保存用户工作台', '库存同时放在两个分组；订货组末尾重复一次库存；包含已删除的系统工作台', [
        {
          groupName: '自定义盘点',
          items: [
            { workbench: { workbenchId: '${checkWorkbenchId}' } },
            { workbench: { workbenchId: '${stockWorkbenchId}' } }
          ]
        },
        {
          groupName: '自定义订货',
          items: [
            { workbench: { workbenchId: '${newOrderWorkbenchId}' } },
            { workbench: { workbenchId: '${stockWorkbenchId}' } },
            { workbench: { workbenchId: '${stockWorkbenchId}' } },
            { workbench: { workbenchId: '${orderWorkbenchId}' } }
          ]
        }
      ], true),
      this.getUser('同一工作台可出现在多个分组', (array) => {
        CheckUtil.expectEqual(array.length, 2, '只返回用户配置里仍能关联到的分组')
        CheckUtil.expectEqual(array[0].groupName, '自定义盘点')
        CheckUtil.expectEqual(array[1].groupName, '自定义订货')
        let checkNames = (array[0].items ?? []).map((item: any) => item.workbench?.name)
        let orderNames = (array[1].items ?? []).map((item: any) => item.workbench?.name)
        CheckUtil.expectEqual(checkNames.join(','), [CHECK_NAME, STOCK_NAME].join(','))
        CheckUtil.expectEqual(orderNames.join(','), [ORDER_NAME, STOCK_NAME].join(','))
        CheckUtil.expectEqual(array[1].items.length, 2, '同组重复的工作台只保留一条')
        CheckUtil.expectEqual(countWorkbench(array, saved.stockId), 2, '库存应同时出现在两个分组')
        CheckUtil.expectEqual(findPlaced(array, SUPPLIER_NAME) == null, true, '供应商工作台不应返回给门店')
        CheckUtil.expectEqual(
          array.some(group => (group.items ?? []).some((item: any) => item.workbench?.workbenchId == saved.orderId)),
          false,
          '已删除的系统工作台不应返回'
        )
        assertClientItem(array[0].items[0], {
          name: CHECK_NAME,
          imageKey: 'img-check2',
          url: '/check',
          routersKey: KEY_CHECK
        })
      }),
      this.saveUser('从盘点分组拿掉库存', '只删这一组的关系，订货分组里的库存还在', [
        {
          groupName: '自定义盘点',
          items: [
            { workbench: { workbenchId: '${checkWorkbenchId}' } }
          ]
        },
        {
          groupName: '自定义订货',
          items: [
            { workbench: { workbenchId: '${newOrderWorkbenchId}' } },
            { workbench: { workbenchId: '${stockWorkbenchId}' } }
          ]
        }
      ]),
      this.getUser('拿掉后库存只留在订货分组', (array) => {
        CheckUtil.expectEqual(array.length, 2)
        CheckUtil.expectEqual(array[0].groupName, '自定义盘点')
        CheckUtil.expectEqual(array[1].groupName, '自定义订货')
        let checkNames = (array[0].items ?? []).map((item: any) => item.workbench?.name)
        let orderNames = (array[1].items ?? []).map((item: any) => item.workbench?.name)
        CheckUtil.expectEqual(checkNames.join(','), CHECK_NAME)
        CheckUtil.expectEqual(orderNames.join(','), [ORDER_NAME, STOCK_NAME].join(','))
        CheckUtil.expectEqual(countWorkbench(array, saved.stockId), 1, '库存只应留在订货分组')
      }),
      this.saveUser('把库存放回盘点分组', '已逻辑删除的同组记录应恢复，而不是再插一条', [
        {
          groupName: '自定义盘点',
          items: [
            { workbench: { workbenchId: '${checkWorkbenchId}' } },
            { workbench: { workbenchId: '${stockWorkbenchId}' } }
          ]
        },
        {
          groupName: '自定义订货',
          items: [
            { workbench: { workbenchId: '${newOrderWorkbenchId}' } },
            { workbench: { workbenchId: '${stockWorkbenchId}' } }
          ]
        }
      ]),
      this.getUser('放回后库存再次出现在两个分组', (array) => {
        CheckUtil.expectEqual(array.length, 2)
        let checkNames = (array[0].items ?? []).map((item: any) => item.workbench?.name)
        let orderNames = (array[1].items ?? []).map((item: any) => item.workbench?.name)
        CheckUtil.expectEqual(checkNames.join(','), [CHECK_NAME, STOCK_NAME].join(','))
        CheckUtil.expectEqual(orderNames.join(','), [ORDER_NAME, STOCK_NAME].join(','))
        CheckUtil.expectEqual(countWorkbench(array, saved.stockId), 2, '库存应再次出现在两个分组')
        CheckUtil.expectEqual(array[0].items.filter((item: any) => item.workbench?.workbenchId == saved.stockId).length, 1)
        CheckUtil.expectEqual(array[1].items.filter((item: any) => item.workbench?.workbenchId == saved.stockId).length, 1)
      }),
      this.clearTestWorkbench('测试结束清理_test_工作台'),
      this.clearTestRouter('测试结束清理_test_权限')
    ]
  }

  private addWorkbench(
    name: string,
    data: any,
    idKey: string,
    onId?: (id: number) => void
  ) {
    return new HttpAction({
      name,
      url: '/admin/workbench/addWorkbench',
      param: data
    }, {
      buildVariable(result) {
        let id = result.result.workbenchId
        if (onId) {
          onId(id)
        }
        return {
          [idKey]: id
        }
      }
    })
  }

  private prepareRouters() {
    return new HttpAction({
      name: '准备测试权限',
      remark: '工作台 routersKey 必须对应未删除权限，且 type 相同',
      url: '/free/add',
      param: {
        table: 'routers',
        array: [
          { name: '_test_订单权限', routersKey: KEY_NOTE, type: TYPE_STORE, isDel: 0 },
          { name: '_test_库存权限', routersKey: KEY_STOCK, type: TYPE_STORE, isDel: 0 },
          { name: '_test_盘点权限', routersKey: KEY_CHECK, type: TYPE_ALL, isDel: 0 },
          { name: '_test_供应权限', routersKey: KEY_SUPPLIER, type: TYPE_SUPPLIER, isDel: 0 }
        ]
      }
    })
  }

  private addFailRoutersType() {
    return new HttpAction({
      name: '权限类型不一致应失败',
      url: '/admin/workbench/addWorkbench',
      exceptHttpStatus: 500,
      param: {
        name: '_test_错类型',
        imageKey: 'img-wrong',
        url: '/wrong',
        groupName: '错类型',
        routersKey: KEY_SUPPLIER,
        type: TYPE_STORE
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(result?.error?.message, '权限类型与工作台类型不一致')
      }
    })
  }

  private addFailType() {
    return new HttpAction({
      name: '新增不填类型应失败',
      url: '/admin/workbench/addWorkbench',
      exceptHttpStatus: 500,
      param: {
        name: '_test_无类型',
        imageKey: 'img-none',
        url: '/none',
        groupName: '无类型',
        routersKey: 'none'
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(result?.error?.message, '请选择类型')
      }
    })
  }

  private updateGroupSort(idExpr: string, groupSort: number) {
    return new HttpAction({
      name: `改 groupSort 为 ${groupSort}`,
      url: '/free/update',
      param: {
        table: 'workbench',
        cdts: [{ col: 'workbenchId', val: idExpr }],
        data: { groupSort }
      }
    })
  }

  private updateWorkbench(name: string, param: any) {
    return new HttpAction({
      name,
      url: '/admin/workbench/updateWorkbench',
      param
    })
  }

  private readMaxGroupSort(name: string, key: string) {
    return new HttpAction({
      name,
      url: '/admin/workbench/listWorkbench',
      param: {}
    }, {
      buildVariable(result) {
        let content: any[] = result.result.content ?? []
        let max = -1
        for (let row of content) {
          if (row.groupSort == null) {
            continue
          }
          let value = Number(row.groupSort)
          if (value > max) {
            max = value
          }
        }
        return {
          [key]: max
        }
      }
    })
  }

  private listCount(name: string, workbenchName: string, count: number) {
    return new HttpAction({
      name,
      url: '/admin/workbench/listWorkbench',
      param: {
        name: workbenchName
      }
    }, {
      check(result) {
        let content: any[] = result.result.content ?? []
        CheckUtil.expectEqual(content.length, count, `${workbenchName} 应有 ${count} 条`)
        for (let row of content) {
          CheckUtil.expectEqual(row.name, workbenchName)
          CheckUtil.expectEqual(row.isDel, 0)
        }
      }
    })
  }

  private listByName(name: string, workbenchName: string, expectRow: any) {
    let test = this
    return new HttpAction({
      name,
      url: '/admin/workbench/listWorkbench',
      param: {
        name: workbenchName
      }
    }, {
      check(result) {
        let content: any[] = result.result.content ?? []
        if (expectRow == null) {
          CheckUtil.expectEqual(content.length, 0, `${workbenchName} 应已删除`)
          return
        }
        let variable = test.getVariable()
        CheckUtil.expectEqual(content.length, 1, `应查到 ${workbenchName}`)
        let row = content[0]
        CheckUtil.expectEqual(row.name, workbenchName)
        CheckUtil.expectEqual(row.imageKey, expectRow.imageKey)
        CheckUtil.expectEqual(row.url, expectRow.url)
        CheckUtil.expectEqual(row.groupName, expectRow.groupName)
        CheckUtil.expectEqual(row.groupSort, valueOf(expectRow.groupSort, variable))
        CheckUtil.expectEqual(row.sort, valueOf(expectRow.sort, variable))
        CheckUtil.expectEqual(row.routersKey, expectRow.routersKey)
        CheckUtil.expectEqual(row.type, expectRow.type)
        CheckUtil.expectEqual(row.isDel, 0)
      }
    })
  }

  private listByType(name: string, type: string, expectNames: string[]) {
    return new HttpAction({
      name,
      url: '/admin/workbench/listWorkbench',
      param: {
        type
      }
    }, {
      check(result) {
        let content: any[] = result.result.content ?? []
        let names = content
          .filter(row => String(row.name || '').indexOf('_test_') == 0)
          .map(row => row.name)
        CheckUtil.expectEqual(names.join(','), expectNames.join(','))
      }
    })
  }

  private listTestOrder(name: string, expectNames: string[]) {
    return new HttpAction({
      name,
      url: '/admin/workbench/listWorkbench',
      param: {}
    }, {
      check(result) {
        let content: any[] = result.result.content ?? []
        let names = content
          .filter(row => String(row.name || '').indexOf('_test_') == 0)
          .map(row => row.name)
        CheckUtil.expectEqual(names.join(','), expectNames.join(','))
      }
    })
  }

  private getSystem(name: string, check: (array: any[]) => void) {
    return new Action({
      name,
      highlight: true,
      url: '/app/workbench/getWorkbench',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        check(result.result.array ?? [])
      }
    })
  }

  private saveUser(name: string, remark: string, array: any[], highlight = false) {
    return new Action({
      name,
      remark,
      highlight,
      url: '/app/workbenchUser/saveWorkbenchUser',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        array
      }
    })
  }

  private getUser(name: string, check: (array: any[]) => void, highlight = false) {
    return new Action({
      name,
      highlight,
      url: '/app/workbenchUser/getWorkbenchUser',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        check(result.result.array ?? [])
      }
    })
  }

  /**
   * 物理删除 name 以 _test_ 开头的系统工作台。
   * LIKE 里 _ 是单字符通配，要写成 \_。
   */
  private clearTestRouter(name: string) {
    return new HttpAction({
      name,
      remark: '删除 name 以 _test_ 开头的权限',
      url: '/free/del',
      param: {
        table: 'routers',
        cdts: [{
          col: 'name',
          val: '\\_test\\_%',
          op: 'like'
        }]
      }
    })
  }

  private clearTestWorkbench(name: string) {
    return new HttpAction({
      name,
      remark: '删除 name 以 _test_ 开头的系统工作台',
      url: '/free/del',
      param: {
        table: 'workbench',
        cdts: [{
          col: 'name',
          val: '\\_test\\_%',
          op: 'like'
        }]
      }
    })
  }
}

class SaveUserToken extends BaseTest {
  constructor() {
    super()
    this.remark = '记下用户 token，运营端登录后还能切回来'
  }

  getName(): string {
    return '保存用户token'
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    return {
      userToken: this.getVariable().token
    }
  }
}

class RestoreUserToken extends BaseTest {
  constructor() {
    super()
    this.remark = '把 token 切回门店用户'
  }

  getName(): string {
    return '恢复用户token'
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    return {
      token: this.getVariable().userToken
    }
  }
}

function valueOf(expect: any, variable: any) {
  if (typeof expect === 'function') {
    return expect(variable)
  }
  return expect
}

function countWorkbench(array: any[], workbenchId?: number) {
  let count = 0
  for (let group of array ?? []) {
    for (let item of group.items ?? []) {
      if (item.workbench?.workbenchId == workbenchId) {
        count++
      }
    }
  }
  return count
}

function findPlaced(array: any[], name: string) {
  for (let gi = 0; gi < array.length; gi++) {
    let items = array[gi].items ?? []
    for (let ii = 0; ii < items.length; ii++) {
      if (items[ii].workbench?.name === name) {
        return {
          gi,
          ii,
          group: array[gi],
          item: items[ii]
        }
      }
    }
  }
  return null
}

function assertClientItem(item: any, expectWorkbench: any) {
  assertOnlyKeys(item, ['workbench'], '用户工作台项')
  assertOnlyKeys(item.workbench, WORKBENCH_KEYS, '系统工作台')
  CheckUtil.expectEqual(item.workbench.name, expectWorkbench.name)
  CheckUtil.expectEqual(item.workbench.imageKey, expectWorkbench.imageKey)
  CheckUtil.expectEqual(item.workbench.url, expectWorkbench.url)
  CheckUtil.expectEqual(item.workbench.routersKey, expectWorkbench.routersKey)
}

function assertOnlyKeys(row: any, keys: string[], label: string) {
  for (let key of Object.keys(row ?? {})) {
    CheckUtil.expectEqual(
      keys.indexOf(key) >= 0,
      true,
      `${label} 不应返回字段 ${key}`
    )
  }
}

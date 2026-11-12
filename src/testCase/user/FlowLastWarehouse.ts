import { BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase, UrlAction } from 'testflow'
import Action from '../../action/Action'
import GetOpenId from '../../action/user/GetOpenId'
import FindLastUserId from '../../action/user/FindLastUserId'
import ChangeWarehouse from '../../action/user/ChangeWarehouse'
import AddWarehouse from '../../action/warehouse/AddWarehouse'

/**
 * 最后登录仓库：getOpenId 按 lastWarehouseId 选仓，changeWarehouse / getOpenId 写入 lastWarehouseId。
 * 同一天只在登录日变化时增加 useDays。占位仓 warehouseId=0 不覆盖已记下的仓库。
 */
export default class extends TestCase {
  /** 同一天切仓前记下的 useDays */
  private useDaysSnap = 0

  constructor() {
    super({ remark: '记录最后登录的仓库，以及同一天不重复增加 useDays' })
  }

  getName(): string {
    return '最后登录仓库'
  }

  protected buildActions(): BaseTest[] {
    let yesterday = StrDateUtil.beforeDay(1)
    return [
      new FindLastUserId().setRemark('查找最大测试用户号'),
      new GetOpenId().setRemark('注册用户，此时还没有仓库'),
      new Expect('占位仓不写 lastWarehouseId', '没有仓库时返回 warehouseId=0', (variable) => {
        CheckUtil.expectEqual(variable.warehouse?.warehouseId, 0, '应返回占位仓')
      }),
      this.queryUser('首次登录不记仓库', 'lastWarehouseId 仍为空或 0', (user) => {
        CheckUtil.expectEqual(isEmptyId(user.lastWarehouseId), true, '占位仓不应写入 lastWarehouseId')
      }),

      new AddWarehouse({
        name: '${openid}_s1',
        type: 'store',
        variableType: 'store1'
      }).setRemark('创建餐厅 store1'),
      new AddWarehouse({
        name: '${openid}_sup',
        type: 'supplier',
        variableType: 'supplierWh'
      }).setRemark('创建供应商，另一个品牌'),
      new AddWarehouse({
        name: '${openid}_s2',
        type: 'store',
        variableType: 'store2'
      }).setRemark('创建餐厅 store2，另一个品牌'),

      new UseWarehouse('store1'),
      new ChangeWarehouse().setRemark('切换到 store1，应写入 lastWarehouseId'),
      this.queryUser('changeWarehouse 写入 store1', '记下 useDays，后面同一天切仓不能再加', (user) => {
        this.useDaysSnap = Number(user.useDays ?? 0)
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, this.getVariable().store1.warehouseId), true, 'lastWarehouseId 应为 store1')
        CheckUtil.expectEqual(dayText(user.lastLogin), DateUtil.todayStr(), '最后登录应为今天')
      }),

      new OpenWarehouse('', '不传 warehouseId，应打开上次的 store1'),
      new Expect('命中上次仓库', '不传 warehouseId 时优先 lastWarehouseId', (variable) => {
        CheckUtil.expectEqual(sameId(variable.openWarehouse?.warehouseId, variable.store1.warehouseId), true, '应打开 store1')
      }),
      this.queryUser('命中后 useDays 不变', '同一天再次 getOpenId，仓库没变也不加 useDays', (user) => {
        CheckUtil.expectEqual(Number(user.useDays ?? 0), this.useDaysSnap, 'useDays 不应增加')
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, this.getVariable().store1.warehouseId), true, 'lastWarehouseId 仍为 store1')
      }),

      new UseWarehouse('store2'),
      new ChangeWarehouse().setRemark('同一天切换到 store2'),
      this.queryUser('同一天切仓只改仓库', 'lastWarehouseId 变为 store2，useDays 不加', (user) => {
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, this.getVariable().store2.warehouseId), true, 'lastWarehouseId 应为 store2')
        CheckUtil.expectEqual(Number(user.useDays ?? 0), this.useDaysSnap, '同一天 useDays 不应增加')
      }),
      new OpenWarehouse('', '不传 warehouseId，应打开 store2'),
      new Expect('再次命中上次仓库', '切到 store2 后，不传 warehouseId 应打开 store2', (variable) => {
        CheckUtil.expectEqual(sameId(variable.openWarehouse?.warehouseId, variable.store2.warehouseId), true, '应打开 store2')
      }),

      new OpenWarehouse('warehouseId=${store1.warehouseId}', '传入 store1，应优先入参而不是 lastWarehouseId'),
      new Expect('入参仓库优先', '传入 warehouseId 时以入参为准', (variable) => {
        CheckUtil.expectEqual(sameId(variable.openWarehouse?.warehouseId, variable.store1.warehouseId), true, '应打开入参 store1')
      }),
      this.queryUser('入参仓库写入 lastWarehouseId', 'getOpenId 进入 store1 后记下该仓', (user) => {
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, this.getVariable().store1.warehouseId), true, 'lastWarehouseId 应为 store1')
      }),

      new OpenWarehouse('warehouseGroupId=${store1.warehouseGroupId}', '品牌与上次仓库一致，仍打开 store1'),
      new Expect('品牌一致时命中上次仓库', '带了 warehouseGroupId 且与 lastWarehouseId 一致', (variable) => {
        CheckUtil.expectEqual(sameId(variable.openWarehouse?.warehouseId, variable.store1.warehouseId), true, '应打开 store1')
      }),

      new UseWarehouse('store2'),
      new ChangeWarehouse().setRemark('把上次仓库改成 store2，用来测品牌不一致'),
      new OpenWarehouse('warehouseGroupId=${supplierWh.warehouseGroupId}', '品牌与上次仓库不一致，应回退到该品牌'),
      new Expect('品牌不一致时回退', '不应再打开 store2', (variable) => {
        CheckUtil.expectEqual(sameId(variable.openWarehouse?.warehouseId, variable.supplierWh.warehouseId), true, '应回退到供应商仓库')
        CheckUtil.expectEqual(sameId(variable.openWarehouse?.warehouseId, variable.store2.warehouseId), false, '不应打开上次的 store2')
      }),

      new UseWarehouse('store1'),
      new ChangeWarehouse().setRemark('把上次仓库改回餐厅，用来测类型不一致'),
      new OpenWarehouse('type=supplier', '类型与上次餐厅不一致，应回退到供应商'),
      new Expect('类型不一致时回退', '上次是餐厅，本次要供应商', (variable) => {
        CheckUtil.expectEqual(variable.openWarehouse?.type, 'supplier', '应回退到供应商')
        CheckUtil.expectEqual(sameId(variable.openWarehouse?.warehouseId, variable.supplierWh.warehouseId), true, '应打开供应商仓库')
      }),

      new Action({
        name: '把登录日改成昨天',
        remark: `lastLogin=${yesterday}，useDays=5，便于断言跨天只加一次`,
        url: '/free/update',
        param: {
          warehouseGroupId: 0,
          table: 'users',
          cdts: [{ col: 'usersId', val: '${usersId}' }],
          data: {
            lastLogin: yesterday,
            useDays: 5,
            lastWarehouseId: '${store1.warehouseId}'
          }
        }
      }),
      new UseWarehouse('store2'),
      new ChangeWarehouse().setRemark('跨天切换到 store2，useDays 应加 1'),
      this.queryUser('跨天 useDays 加一', 'lastLogin 变为今天，lastWarehouseId 为 store2', (user) => {
        CheckUtil.expectEqual(Number(user.useDays), 6, 'useDays 应为 6')
        CheckUtil.expectEqual(dayText(user.lastLogin), DateUtil.todayStr(), '最后登录应为今天')
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, this.getVariable().store2.warehouseId), true, 'lastWarehouseId 应为 store2')
      }),
      new UseWarehouse('supplierWh'),
      new ChangeWarehouse().setRemark('同一天再切换，useDays 不再加'),
      this.queryUser('同一天第二次切仓不加天数', 'useDays 保持 6，仓库改为供应商', (user) => {
        CheckUtil.expectEqual(Number(user.useDays), 6, 'useDays 仍应为 6')
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, this.getVariable().supplierWh.warehouseId), true, 'lastWarehouseId 应为供应商')
      }),

      new SaveKey('token', 'userToken', '记下当前用户 token'),
      new SaveKey('openid', 'userOpenid', '记下当前用户 openid'),
      new FindLastUserId().setRemark('再取一个测试用户号'),
      new Action({
        name: '注册无权限对照用户',
        remark: '按新 openid 建用户，随后用他的仓库做无权限 lastWarehouseId',
        url: '/free/getUserToken',
        param: {
          warehouseGroupId: 0,
          code: '${openid}'
        }
      }, {
        buildVariable(result) {
          return {
            token: result.result.token.token
          }
        }
      }),
      new AddWarehouse({
        name: '${openid}_other',
        type: 'store',
        variableType: 'otherWh'
      }).setRemark('对照用户的餐厅，当前用户没有权限'),
      new RestoreUser(),

      new Action({
        name: '把上次仓库改成无权限的仓',
        remark: 'lastWarehouseId 指向对照用户的餐厅',
        url: '/free/update',
        param: {
          warehouseGroupId: 0,
          table: 'users',
          cdts: [{ col: 'usersId', val: '${usersId}' }],
          data: {
            lastWarehouseId: '${otherWh.warehouseId}'
          }
        }
      }),
      new OpenWarehouse('', '无权限的 lastWarehouseId 应回退到自己的仓库'),
      new Expect('无权限时回退', '不能打开对照用户的仓库', (variable) => {
        CheckUtil.expectEqual(isEmptyId(variable.openWarehouse?.warehouseId), false, '自己还有仓库，不应是占位仓')
        CheckUtil.expectEqual(sameId(variable.openWarehouse?.warehouseId, variable.otherWh.warehouseId), false, '不应打开无权限仓库')
      }),
      this.queryUser('无权限回退后写入实际进入的仓', 'lastWarehouseId 不再是对照仓库', (user) => {
        let openId = this.getVariable().openWarehouse?.warehouseId
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, openId), true, '应记下实际进入的仓库')
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, this.getVariable().otherWh.warehouseId), false, '不应留下无权限仓库')
      }),

      new Action({
        name: '插入已删除仓库',
        remark: '不绑定到当前用户，lastWarehouseId 指向它时应回退',
        url: '/free/add',
        param: {
          warehouseGroupId: 0,
          table: 'warehouse',
          array: [{
            name: '_test_del_${userOpenid}',
            type: 'store',
            isDel: 1,
            warehouseGroupId: 0
          }]
        }
      }, {
        buildVariable(result) {
          let row = (result.result ?? [])[0]
          return {
            delWarehouseId: row?.warehouseId
          }
        }
      }),
      new Action({
        name: '把上次仓库改成已删除的仓',
        url: '/free/update',
        param: {
          warehouseGroupId: 0,
          table: 'users',
          cdts: [{ col: 'usersId', val: '${usersId}' }],
          data: {
            lastWarehouseId: '${delWarehouseId}'
          }
        }
      }),
      new OpenWarehouse('', '已删除的 lastWarehouseId 应回退'),
      new Expect('已删除时回退', '不能打开已删除仓库', (variable) => {
        CheckUtil.expectEqual(sameId(variable.openWarehouse?.warehouseId, variable.delWarehouseId), false, '不应打开已删除仓库')
      }),
      this.queryUser('已删除回退后写入实际进入的仓', 'lastWarehouseId 不再是已删除仓库', (user) => {
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, this.getVariable().delWarehouseId), false, '不应留下已删除仓库')
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, this.getVariable().openWarehouse?.warehouseId), true, '应记下实际进入的仓库')
      }),

      new Action({
        name: '记下 store1 并取消全部仓库权限',
        remark: '占位仓返回时不能把 lastWarehouseId 改成 0',
        url: '/free/update',
        param: {
          warehouseGroupId: 0,
          table: 'users',
          cdts: [{ col: 'usersId', val: '${usersId}' }],
          data: {
            lastWarehouseId: '${store1.warehouseId}'
          }
        }
      }),
      new Action({
        name: '解除全部仓库权限',
        url: '/free/update',
        param: {
          warehouseGroupId: 0,
          table: 'usersWarehouse',
          cdts: [{ col: 'usersId', val: '${usersId}' }],
          data: {
            isDel: 1
          }
        }
      }),
      new OpenWarehouse('', '没有可用仓库时返回占位仓'),
      new Expect('无权限返回占位仓', 'warehouseId 应为 0', (variable) => {
        CheckUtil.expectEqual(isEmptyId(variable.openWarehouse?.warehouseId), true, '应返回占位仓')
      }),
      this.queryUser('占位仓不覆盖 lastWarehouseId', '仍保留 store1', (user) => {
        CheckUtil.expectEqual(sameId(user.lastWarehouseId, this.getVariable().store1.warehouseId), true, 'lastWarehouseId 应仍是 store1')
      })
    ]
  }

  private queryUser(name: string, remark: string, check: (user: any) => void): BaseTest {
    return new Action({
      name,
      remark,
      url: '/free/query',
      param: {
        warehouseGroupId: 0,
        array: [{
          table: 'users',
          query: {
            usersId: '${usersId}',
            isDel: 0
          }
        }]
      }
    }, {
      check: (result) => {
        let rows: any[] = result.result?.users ?? []
        CheckUtil.expectEqual(rows.length, 1, '应查到用户')
        check(rows[0])
      }
    })
  }
}

function isEmptyId(value: any): boolean {
  return value == null || value === '' || Number(value) == 0
}

function sameId(actual: any, expect: any): boolean {
  if (isEmptyId(actual) || isEmptyId(expect)) {
    return isEmptyId(actual) && isEmptyId(expect)
  }
  return String(actual) == String(expect)
}

function dayText(value: any): string {
  if (value == null || value === '') {
    return ''
  }
  if (value instanceof Date) {
    return DateUtil.format(value)
  }
  let text = String(value).trim()
  if (text.includes('T') || text.length > 10) {
    let date = new Date(text)
    if (!Number.isNaN(date.getTime())) {
      return DateUtil.format(date)
    }
  }
  return text.substring(0, 10)
}

class OpenWarehouse extends UrlAction {
  constructor(private extra: string, remark: string) {
    super()
    this.remark = remark
  }

  getName(): string {
    return this.extra ? `getOpenId ${this.extra}` : 'getOpenId'
  }

  protected getMethod(): string {
    return 'GET'
  }

  protected getHttpUrl(): string {
    let url = '/free/getOpenId?code=${openid}'
    if (this.extra) {
      url += '&' + this.extra
    }
    return url
  }

  protected buildVariable(result: any) {
    return {
      openWarehouse: result.result?.warehouse,
      token: result.result?.token?.token
    }
  }
}

class UseWarehouse extends BaseTest {
  constructor(private key: string) {
    super()
    this.remark = `把当前仓库变量指到 ${key}`
  }

  getName(): string {
    return `使用${this.key}`
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    return {
      warehouse: this.getVariable()[this.key]
    }
  }
}

class SaveKey extends BaseTest {
  constructor(private from: string, private to: string, remark: string) {
    super()
    this.remark = remark
  }

  getName(): string {
    return `保存${this.to}`
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    return {
      [this.to]: this.getVariable()[this.from]
    }
  }
}

class RestoreUser extends BaseTest {
  constructor() {
    super()
    this.remark = '切回第一个用户的 token 和 openid'
  }

  getName(): string {
    return '恢复当前用户'
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    let variable = this.getVariable()
    return {
      token: variable.userToken,
      openid: variable.userOpenid
    }
  }
}

class Expect extends BaseTest {
  constructor(name: string, remark: string, private fn: (variable: any) => void) {
    super()
    this.nameText = name
    this.remark = remark
  }

  private nameText: string

  getName(): string {
    return this.nameText
  }

  protected async doTest(): Promise<any> {
    this.fn(this.getVariable())
  }
}

import { BaseTest, CheckUtil, DateUtil, HttpAction, StrDateUtil, TestCase } from 'testflow'
import Action from '../../action/Action'
import CheckArray from '../../action/CheckArray'
import LoginAdmin from '../../action/adminUser/LoginAdmin'
import FindLastUserId from '../../action/user/FindLastUserId'
import GetOpenId from '../../action/user/GetOpenId'
import AddWarehouse from '../../action/warehouse/AddWarehouse'

/** 与 WarehouseDomain.S_ExpDays 一致 */
const EXP_DAYS = 7
const FORGED_DATE = '2099-01-01'
const SET_DATE = '2030-01-01'

function todayPlusExp(): string {
  return StrDateUtil.add(DateUtil.todayStr(), EXP_DAYS)
}

/**
 * 查询接口会把日期收成 UTC 时间，例如 2026-11-02 变成 2026-11-01T16:00:00.000Z。
 * 按本地日历日比较，不能直接截取前 10 位。
 */
function expText(value: any): string {
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

/**
 * 新建仓库过期日为今天后 7 天，请求里的日期不生效。
 * 运营端 /admin/warehouse/setExpDate 可以改期。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '仓库过期日：新建为今天后7天；运营端可改期' })
  }

  getName(): string {
    return '仓库过期日'
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      this.checkExp('新建仓库过期日为今天后7天', '${warehouse.warehouseId}', () => todayPlusExp()),

      new Action({
        name: '请求中的过期日不生效',
        remark: '传入 2099-01-01，仍应为今天后 7 天',
        url: '/app/warehouse/addwarehouse',
        param: {
          name: '${openid}_exp',
          type: 'store',
          expDate: FORGED_DATE
        }
      }, {
        check(result) {
          CheckUtil.expectEqual(
            expText(result.result.expDate),
            todayPlusExp(),
            '新建仓库过期日应为今天后7天'
          )
        }
      }),

      new Action({
        name: '注册品牌时写入过期日',
        remark: '走 WarehouseDomain.reg，传入的过期日不生效',
        url: '/free/regWarehouseGroup',
        param: {
          name: '${openid}_reg',
          warehouseGroupName: '${openid}品牌',
          expDate: FORGED_DATE
        }
      }, {
        buildVariable(result) {
          return {
            regWarehouseId: result.result.warehouse.warehouseId
          }
        }
      }),
      new CheckArray([{
        table: 'warehouse',
        notWarehouseGroupId: true,
        query: {
          warehouseId: '${regWarehouseId}'
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '应查到注册出来的仓库')
          CheckUtil.expectEqual(
            expText(array[0].expDate),
            todayPlusExp(),
            '注册仓库过期日应为今天后7天'
          )
        }
      }]).setRemark('校验注册仓库的过期日'),

      new Action({
        name: '修改仓库不能改过期日',
        remark: '业务更新传入 2099-01-01，过期日保持不变',
        url: '/app/warehouse/updateWarehouse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          name: '${warehouse.name}',
          expDate: FORGED_DATE
        }
      }),
      this.checkExp('业务更新后过期日不变', '${warehouse.warehouseId}', () => todayPlusExp()),

      new SaveUserToken(),
      new LoginAdmin(),
      new HttpAction({
        name: '运营端设置过期日',
        url: '/admin/warehouse/setExpDate',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          expDate: SET_DATE
        }
      }),
      this.checkExp('运营端改期已写入', '${warehouse.warehouseId}', SET_DATE),
      new HttpAction({
        name: '非法过期日应失败',
        url: '/admin/warehouse/setExpDate',
        exceptHttpStatus: 500,
        param: {
          warehouseId: '${warehouse.warehouseId}',
          expDate: '2020-13-40'
        }
      }, {
        check(result) {
          CheckUtil.expectEqual(result?.error?.message, '过期时间格式错误')
        }
      }),

      new RestoreUserToken(),
      new Action({
        name: '切换仓库返回过期日',
        url: '/app/warehouseGroup/changeWarehouse',
        param: {
          warehouse: {
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            warehouseId: '${warehouse.warehouseId}'
          }
        }
      }, {
        check(result) {
          CheckUtil.expectEqual(
            expText(result.result.warehouse.expDate),
            SET_DATE,
            '切换仓库应返回运营端设置的过期日'
          )
        }
      })
    ]
  }

  private checkExp(remark: string, warehouseId: string, expect: string | (() => string)) {
    return new CheckArray([{
      table: 'warehouse',
      notWarehouseGroupId: true,
      query: {
        warehouseId
      },
      check(array) {
        let expected = typeof expect == 'function' ? expect() : expect
        CheckUtil.expectEqual(array.length, 1, '应查到仓库')
        CheckUtil.expectEqual(expText(array[0].expDate), expected, remark)
      }
    }]).setRemark(remark)
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

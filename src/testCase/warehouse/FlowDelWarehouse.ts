import { BaseTest, CheckUtil, TestCase } from "testflow";
import Action from "../../action/Action";
import CheckArray from "../../action/CheckArray";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import AddWarehouse from "../../action/warehouse/AddWarehouse";

/**
 * 删除仓库：管理员删 warehouse，非管理员只删自己的 usersWarehouse（见同目录 FlowDelWarehouse.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '删除仓库：非管理员只解绑，管理员逻辑删除仓库' })
  }

  getName(): string {
    return '删除仓库'
  }

  protected buildActions(): BaseTest[] {
    return [
      new InitAdmin(),

      new CheckArray([{
        table: 'usersWarehouse',
        query: {
          usersId: '${usersId}',
          warehouseId: 0,
          isAdmin: 1
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '创建人应为品牌管理员 warehouseId=0')
        }
      }]).setRemark('校验管理员 usersWarehouse：warehouseId=0、isAdmin=1'),

      new SaveAdminToken(),
      new InitMember(),

      new Action({
        name: '给非管理员绑定仓库',
        remark: '插入 isAdmin=0 的 usersWarehouse',
        url: '/free/add',
        param: {
          table: 'usersWarehouse',
          array: [{
            usersId: '${memberUsersId}',
            warehouseId: '${warehouse.warehouseId}',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            isAdmin: 0,
            isDel: 0
          }]
        }
      }),

      new CheckArray([{
        table: 'usersWarehouse',
        query: {
          usersId: '${memberUsersId}',
          warehouseId: '${warehouse.warehouseId}',
          isAdmin: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '非管理员应已绑定当前仓库')
        }
      }]).setRemark('校验非管理员已绑定仓库'),

      new DelByMember(),
      new RestoreAdminToken(),
      new DelByAdmin()
    ]
  }
}

class InitAdmin extends TestCase {
  constructor() {
    super({ remark: '创建管理员与第一家门店' })
  }

  getName(): string {
    return '数据初始化'
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId().setRemark('查找最大测试用户号'),
      new GetOpenId().setRemark('注册管理员并拿到 token'),
      new AddWarehouse().setRemark('创建门店（品牌管理员 warehouseId=0）'),
      new ChangeWarehouse().setRemark('切换到该门店')
    ]
  }
}

class SaveAdminToken extends BaseTest {
  constructor() {
    super()
    this.remark = '记下管理员 token，切走后还能切回来'
  }

  getName(): string {
    return '保存管理员token'
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    return {
      adminToken: this.getVariable().token
    }
  }
}

class InitMember extends TestCase {
  constructor() {
    super({ remark: '再注册一个用户，作为非管理员' })
  }

  getName(): string {
    return '注册非管理员'
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId().setRemark('再取一个测试用户号'),
      new Action({
        name: '注册非管理员',
        remark: 'getUserToken 不沿用当前 token，避免还是管理员',
        url: '/free/getUserToken',
        param: {
          code: '${openid}'
        }
      }, {
        buildVariable(result) {
          return {
            memberUsersId: result.result.token.usersId,
            memberToken: result.result.token.token
          }
        }
      })
    ]
  }
}

class SwitchToMemberToken extends BaseTest {
  constructor() {
    super()
    this.remark = '把 token 切到非管理员'
  }

  getName(): string {
    return '切换到非管理员'
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    return {
      token: this.getVariable().memberToken
    }
  }
}

class RestoreAdminToken extends BaseTest {
  constructor() {
    super()
    this.remark = '把 token 切回管理员'
  }

  getName(): string {
    return '恢复管理员token'
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    return {
      token: this.getVariable().adminToken
    }
  }
}

class DelByMember extends TestCase {
  constructor() {
    super({ remark: '非管理员删除：只把自己的 usersWarehouse 设为 isDel=1，仓库仍在' })
  }

  getName(): string {
    return '非管理员删除仓库'
  }

  protected buildActions(): BaseTest[] {
    return [
      new SwitchToMemberToken(),
      new ChangeWarehouse().setRemark('非管理员切到该门店'),
      new Action({
        name: '非管理员删除仓库',
        remark: 'delWarehouse，应只解绑自己',
        url: '/app/warehouse/delWarehouse',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }),
      new CheckArray([{
        table: 'warehouse',
        query: {
          warehouseId: '${warehouse.warehouseId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '非管理员删除后仓库应仍存在')
        }
      }, {
        table: 'usersWarehouse',
        query: {
          usersId: '${memberUsersId}',
          warehouseId: '${warehouse.warehouseId}',
          isDel: 1
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '非管理员的 usersWarehouse 应为 isDel=1')
        }
      }]).setRemark('校验非管理员删除：仓库未删、自己的关联已删')
    ]
  }
}

class DelByAdmin extends TestCase {
  constructor() {
    super({ remark: '管理员删除：把 warehouse 设为 isDel=1' })
  }

  getName(): string {
    return '管理员删除仓库'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '管理员删除仓库',
        remark: 'delWarehouse，应逻辑删除仓库',
        url: '/app/warehouse/delWarehouse',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }),
      new CheckArray([{
        table: 'warehouse',
        query: {
          warehouseId: '${warehouse.warehouseId}',
          isDel: 1
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '管理员删除后仓库应为 isDel=1')
        }
      }]).setRemark('校验管理员删除后 warehouse.isDel=1')
    ]
  }
}

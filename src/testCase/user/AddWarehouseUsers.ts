import { BaseTest, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import Action from "../../action/Action";

export interface WarehouseUserOpt {
  /** 变量前缀，结果写入 ${key}UsersId、${key}Token */
  key: string;
  /** 不传则不改 nickName，名字会落成工蜂加用户 id */
  nickName?: string;
}

/**
 * 给指定仓库增加可登录用户。
 * 每个用户走 FindLastUserId、getOpenId，再写入 users_warehouse。
 */
export class AddWarehouseUsers extends TestCase {
  private warehouseKey: string;
  private users: WarehouseUserOpt[];

  constructor(opt: {
    warehouseKey: string;
    users: WarehouseUserOpt[];
    remark?: string;
  }) {
    super({ remark: opt.remark ?? '给仓库增加操作用户' });
    this.warehouseKey = opt.warehouseKey;
    this.users = opt.users;
  }

  getName(): string {
    return '增加仓库用户';
  }

  protected buildActions(): BaseTest[] {
    let actions: BaseTest[] = [];
    for (let user of this.users) {
      actions.push(...this.buildUser(user));
    }
    return actions;
  }

  private buildUser(user: WarehouseUserOpt): BaseTest[] {
    const key = user.key;
    let steps: BaseTest[] = [
      new FindLastUserId().setRemark(`取${key}的openid`),
      new GetOpenId().setRemark(`注册${key}`),
      new SaveUserVar(key),
      new Action({
        name: `${key}加入仓库`,
        remark: `写入 users_warehouse，使${key}能操作该仓库`,
        url: '/free/add',
        param: {
          table: 'usersWarehouse',
          array: [{
            usersId: `\${${key}UsersId}`,
            warehouseId: `\${${this.warehouseKey}.warehouseId}`,
            warehouseGroupId: `\${${this.warehouseKey}.warehouseGroupId}`,
            isAdmin: 0,
            isDel: 0
          }]
        }
      })
    ];
    if (user.nickName != null && user.nickName !== '') {
      steps.push(new Action({
        name: `${key}设置昵称`,
        remark: `nickName=${user.nickName}`,
        url: '/free/update',
        param: {
          table: 'users',
          cdts: [
            { col: 'usersId', val: `\${${key}UsersId}` }
          ],
          data: { nickName: user.nickName }
        }
      }));
    }
    return steps;
  }
}

class SaveUserVar extends BaseTest {
  private key: string;

  constructor(key: string) {
    super();
    this.key = key;
    this.remark = `记下${key}的 usersId 和 token`;
  }

  getName(): string {
    return `保存${this.key}`;
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    let variable = this.getVariable();
    return {
      [`${this.key}UsersId`]: variable.usersId,
      [`${this.key}Token`]: variable.token
    };
  }
}

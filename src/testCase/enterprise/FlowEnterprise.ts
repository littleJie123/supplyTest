import { BaseTest, CheckUtil, TestCase } from "testflow";
import Action from "../../action/Action";
import CheckArray from "../../action/CheckArray";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import AddWarehouse from "../../action/warehouse/AddWarehouse";

/**
 * 企业号全流程（见同目录 FlowEnterprise.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '企业号：有无/列表/改名/加仓库(cnt)/逻辑删除' })
  }

  getName(): string {
    return '企业号'
  }

  protected buildActions(): BaseTest[] {
    return [
      new InitEnterprise(),

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
      }]).setRemark('校验创建人 usersWarehouse：warehouseId=0、isAdmin=1'),

      new CheckNoEnterprise(),

      new Action({
        name: '开通企业号额度',
        remark: '把当前品牌 cnt 设为 2',
        url: '/free/update',
        param: {
          table: 'warehouseGroup',
          cdts: [
            { col: 'warehouseGroupId', val: '${warehouse.warehouseGroupId}' }
          ],
          data: { cnt: 2 }
        }
      }),

      new CheckHasEnterprise(),

      new Action({
        name: '修改品牌名称',
        remark: '改名为「企业号品牌」，目标 id 放在 warehouse 里',
        url: '/app/warehouseGroup/updateWarehouseGroup',
        param: {
          warehouse: {
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            name: '企业号品牌'
          }
        }
      }),

      new Action({
        name: '企业号列表(改名后)',
        remark: '列表中该品牌名称应为「企业号品牌」',
        url: '/app/warehouseGroup/listWarehouseGroup',
        param: {}
      }, {
        check(result) {
          let content = result.result.content ?? []
          CheckUtil.expectEqual(content.length, 1, '改名后企业号仍应 1 条')
          CheckUtil.expectEqual(content[0].name, '企业号品牌', '品牌名称未改成企业号品牌')
        }
      }),

      new Action({
        name: '增加第二家门店',
        remark: '增加「企业号门店2」，目标品牌放在 warehouse 里',
        url: '/app/warehouse/addWarehouseToGroup',
        param: {
          warehouse: {
            name: '企业号门店2',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            type: 'store'
          }
        }
      }, {
        buildVariable(result) {
          return {
            secondWarehouse: result.result
          }
        }
      }),

      new Action({
        name: '列出品牌仓库(2家)',
        remark: '该品牌应有 2 家未删除仓库',
        url: '/app/warehouse/listWarehouse',
        param: {}
      }, {
        check(result) {
          let content = result.result.content ?? []
          CheckUtil.expectEqual(content.length, 2, '加店后应有 2 家仓库')
          CheckUtil.expectEqual(
            content.some((row: any) => row.name === '企业号门店2'),
            true,
            '列表中应有企业号门店2'
          )
        }
      }),

      new DelSecondWarehouse(),

      new Action({
        name: '再增加第三家门店',
        remark: '删除后额度又够，增加「企业号门店3」',
        url: '/app/warehouse/addWarehouseToGroup',
        param: {
          warehouse: {
            name: '企业号门店3',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            type: 'store'
          }
        }
      }),

      new Action({
        name: '列出品牌仓库(删后加回)',
        remark: '应有第一家 + 企业号门店3，共 2 家',
        url: '/app/warehouse/listWarehouse',
        param: {}
      }, {
        check(result) {
          let content = result.result.content ?? []
          CheckUtil.expectEqual(content.length, 2, '删后再加应仍有 2 家仓库')
          CheckUtil.expectEqual(
            content.some((row: any) => row.name === '企业号门店3'),
            true,
            '列表中应有企业号门店3'
          )
          CheckUtil.expectEqual(
            content.some((row: any) => row.name === '企业号门店2'),
            false,
            '已逻辑删除的企业号门店2不应出现'
          )
        }
      })
    ]
  }
}

class InitEnterprise extends TestCase {
  constructor() {
    super({ remark: '创建测试用户与第一家门店' })
  }

  getName(): string {
    return '数据初始化'
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId().setRemark('查找最大测试用户号'),
      new GetOpenId().setRemark('注册用户并拿到 token'),
      new AddWarehouse().setRemark('创建第一家门店（品牌管理员 warehouseId=0）'),
      new ChangeWarehouse().setRemark('切换到第一家门店')
    ]
  }
}

class CheckNoEnterprise extends TestCase {
  constructor() {
    super({ remark: '开通前：有无企业号为 false，列表为空' })
  }

  getName(): string {
    return '校验未开通企业号'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '有无企业号(未开通)',
        remark: 'cnt 未开通时应为 false',
        url: '/app/warehouseGroup/hasEnterprise',
        param: {}
      }, {
        check(result) {
          CheckUtil.expectEqual(result.result.hasEnterprise, false, '未开通时 hasEnterprise 应为 false')
        }
      }),
      new Action({
        name: '企业号列表(未开通)',
        remark: 'cnt 未开通时列表应为空',
        url: '/app/warehouseGroup/listWarehouseGroup',
        param: {}
      }, {
        check(result) {
          let content = result.result.content ?? []
          CheckUtil.expectEqual(content.length, 0, '未开通时企业号列表应为空')
        }
      })
    ]
  }
}

class CheckHasEnterprise extends TestCase {
  constructor() {
    super({ remark: '开通后：有无企业号为 true，列表含当前品牌' })
  }

  getName(): string {
    return '校验已开通企业号'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new Action({
        name: '有无企业号(已开通)',
        remark: 'cnt=2 后应为 true',
        url: '/app/warehouseGroup/hasEnterprise',
        param: {}
      }, {
        check(result) {
          CheckUtil.expectEqual(result.result.hasEnterprise, true, '开通后 hasEnterprise 应为 true')
        }
      }),
      new Action({
        name: '企业号列表(已开通)',
        remark: '应有 1 条，id 为当前品牌',
        url: '/app/warehouseGroup/listWarehouseGroup',
        param: {}
      }, {
        check(result) {
          let content = result.result.content ?? []
          CheckUtil.expectEqual(content.length, 1, '开通后企业号应有 1 条')
          CheckUtil.expectEqual(
            String(content[0].warehouseGroupId),
            String(variable.warehouse?.warehouseGroupId),
            '企业号列表应是当前品牌'
          )
        }
      })
    ]
  }
}

class DelSecondWarehouse extends TestCase {
  constructor() {
    super({ remark: '逻辑删除第二家门店，并校验列表与 isDel' })
  }

  getName(): string {
    return '删除第二家门店'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '删除企业号仓库',
        remark: 'delEnterpriseWarehouse，目标 id 放在 warehouse 里',
        url: '/app/warehouse/delEnterpriseWarehouse',
        param: {
          warehouse: {
            warehouseId: '${secondWarehouse.warehouseId}',
            warehouseGroupId: '${warehouse.warehouseGroupId}'
          }
        }
      }),
      new Action({
        name: '列出品牌仓库(删除后)',
        remark: '未删除仓库应只剩 1 家',
        url: '/app/warehouse/listWarehouse',
        param: {}
      }, {
        check(result) {
          let content = result.result.content ?? []
          CheckUtil.expectEqual(content.length, 1, '删除后应只剩 1 家仓库')
          CheckUtil.expectEqual(
            content.some((row: any) => row.name === '企业号门店2'),
            false,
            '企业号门店2不应再出现在列表'
          )
        }
      }),
      new CheckArray([{
        table: 'warehouse',
        query: {
          warehouseId: '${secondWarehouse.warehouseId}',
          isDel: 1
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '第二家门店应为 isDel=1')
        }
      }]).setRemark('校验第二家门店 isDel=1')
    ]
  }
}

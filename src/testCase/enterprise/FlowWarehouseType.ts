import { BaseTest, CheckUtil, TestCase } from "testflow";
import Action from "../../action/Action";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";

/**
 * 校验 /app/warehouseGroup/hasEnterprise 的 warehouseType。
 * 没有仓库或两种都有为 all，只有餐厅为 onlyStore，只有供应商为 onlySupplier。
 * 已删除仓库不计入。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '我的页：按拥有的餐厅/供应商返回 warehouseType' })
  }

  getName(): string {
    return '仓库类型'
  }

  protected buildActions(): BaseTest[] {
    return [
      new InitUser(),
      new CheckWarehouseType('all', '一条仓库都没有'),
      new AddWarehouse().setRemark('创建餐厅'),
      new CheckWarehouseType('onlyStore', '只有餐厅'),
      new AddWarehouse({
        name: '仓库类型供应商',
        type: 'supplier',
        variableType: 'supplierWarehouse'
      }).setRemark('再创建一个供应商仓库'),
      new CheckWarehouseType('all', '餐厅和供应商都有'),
      new DelSupplierWarehouse(),
      new CheckWarehouseType('onlyStore', '供应商已删除，只剩餐厅'),
      new InitSupplierUser(),
      new CheckWarehouseType('onlySupplier', '只有供应商'),
      new AddWarehouse({
        name: '仓库类型餐厅',
        type: 'store',
        variableType: 'storeWarehouse'
      }).setRemark('再创建餐厅，使餐厅和供应商都有'),
      new CheckWarehouseType('all', '两个都有')
    ]
  }
}

class InitUser extends TestCase {
  constructor() {
    super({ remark: '注册用户，此时还没有仓库' })
  }

  getName(): string {
    return '注册用户'
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId().setRemark('查找最大测试用户号'),
      new GetOpenId().setRemark('注册用户并拿到 token')
    ]
  }
}

class InitSupplierUser extends TestCase {
  constructor() {
    super({ remark: '另注册一个用户，只创建供应商仓库' })
  }

  getName(): string {
    return '只拥有供应商'
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId().setRemark('查找最大测试用户号'),
      new GetOpenId().setRemark('注册另一个用户'),
      new AddWarehouse({
        name: '仅供应商',
        type: 'supplier'
      }).setRemark('只创建供应商仓库')
    ]
  }
}

class CheckWarehouseType extends Action {
  constructor(warehouseType: string, scene: string) {
    super({
      name: '仓库类型(' + scene + ')',
      remark: scene + ' 时 warehouseType 应为 ' + warehouseType,
      url: '/app/warehouseGroup/hasEnterprise',
      param: {}
    }, {
      check(result) {
        CheckUtil.expectEqual(
          result.result.warehouseType,
          warehouseType,
          scene + ' 时 warehouseType 应为 ' + warehouseType
        )
        CheckUtil.expectEqual(
          result.result.hasEnterprise,
          false,
          scene + ' 时未开通企业号 hasEnterprise 应为 false'
        )
      }
    })
  }
}

class DelSupplierWarehouse extends Action {
  constructor() {
    super({
      name: '删除供应商仓库',
      remark: '逻辑删除供应商仓库，已删除的不计入 warehouseType',
      url: '/app/warehouse/delEnterpriseWarehouse',
      param: {
        warehouse: {
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
        }
      }
    })
  }
}

import { ArrayUtil, BaseTest, TestCase } from "testflow";
import AddMaterial from "../action/material/AddMaterial";
import GetMaterialInfo from "../action/material/GetMaterialInfo";
import UpdateMaterial from "../action/material/UpdateMaterial";
import UpdateMaterial2 from "../action/material/UpdateMaterial2";
import AddSupplier from "../action/supplier/AddSupplier";
import ListSupplier from "../action/supplier/ListSupplier";
import FindLastUserId from "../action/user/FindLastUserId";
import GetOpenId from "../action/user/GetOpenId";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import ListMaterial from "../action/material/ListMaterial";
import Action from "../action/Action";
/**
 * - 创建了 餐厅、供应商、物料  
 * - 没有供应商账号和订单
 */
export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new AddSupplier('供应商1'),
      new AddSupplier('供应商2'),
      this.buildAddCategory('肉类'),
      this.buildAddCategory('蛋类'),
      this.buildAddCategory('蔬菜'),
      new Action({
        name:'查询分类',
        url: '/app/category/listCategory',
        param: {}
      }, {
        buildVariable(result) {
          let content = result.result.content;
          return {
            categoryMap: ArrayUtil.toMapByKey(content, 'name', 'categoryId')
          }
        }
      }),
      new ListSupplier(),
      new AddMaterial('猪肉', {
        buyUnit: [
          { "name": "瓶" }, { "name": "箱", isSupplier: true, fee: 10 }
        ],
        categoryId: '${categoryMap.肉类}'
      }),
      new AddMaterial('羊肉', { categoryId: '${categoryMap.肉类}' }),
      new UpdateMaterial('羊肉',{ categoryId: '${categoryMap.肉类}' }),
      new AddMaterial('牛肉', {
        categoryId: '${categoryMap.肉类}',
        suppliers: [
          {
            "isDef": true,
            "supplierId": "${supplierMap.供应商2}",

            "price": 10
          }]
      }),
      new AddMaterial('鸡蛋', { categoryId: '${categoryMap.蛋类}' }),
      new AddMaterial('白菜', { categoryId: '${categoryMap.蔬菜}' }),
      new ListMaterial()
    ]
  }
  getName(): string {
    return '数据初始化'
  }
  needInScreen(): boolean {
    return false;
  }

  private buildAddCategory(name: string) {
    return new Action({
      name:'新增分类：'+name,
      url: '/app/category/addCategory',
      param: {
        name
      }
    })
  }


}
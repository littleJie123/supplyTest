import { BaseTest, TestCase } from "testflow";
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

export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new AddSupplier('供应商1'),
      new AddSupplier('供应商2'),
      new ListSupplier(),
      new AddMaterial('猪肉', {
        buyUnit: [
          { "name": "瓶"  },{ "name": "箱", isSupplier: true,fee:10 }
        ]
      }),
      new AddMaterial('羊肉'),
      new UpdateMaterial('羊肉'),
      new AddMaterial('牛肉',{
        suppliers:[
        {
          "isDef": true,
          "supplierId": "${supplierMap.供应商2}",
          
          "price": 10
        }]
      }),

      new ListMaterial()
    ]
  }
  getName(): string {
    return '数据初始化'
  }
  needInScreen(): boolean {
    return false;
  }


}
import { TestCase,ITest, BaseTest } from "testflow";

import FindLastUserId from "../action/user/FindLastUserId";
import GetOpenId from "../action/user/GetOpenId";
import AddSupplier from "../action/supplier/AddSupplier";
import AddMaterial from "../action/material/AddMaterial";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import ListSupplier from "../action/supplier/ListSupplier";
import UpdateMaterial from "../action/material/UpdateMaterial";
import GetMaterialInfo from "../action/material/GetMaterialInfo";
import UpdateMaterial2 from "../action/material/UpdateMaterial2";

export default class extends TestCase{
  buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new AddSupplier('供应商1'),
      new AddSupplier('供应商2'),
      new ListSupplier(),
      new AddMaterial('猪肉'),
      new UpdateMaterial('猪肉'),
      new GetMaterialInfo({
        buyUnitFee:500,
        price:0.2
      }),

      new AddMaterial('羊肉'),
      new UpdateMaterial2('羊肉'),
      new GetMaterialInfo({
        buyUnitFee:-10,
        price:200
      },'供应商2'),
      new UpdateMaterial2('羊肉',true),
      new GetMaterialInfo({
        buyUnitFee:-10,
        price:150
      },'供应商1',1),
    ]
  }
  getName(): string {
    return '物料逻辑'
  }
  
}
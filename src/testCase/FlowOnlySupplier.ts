import { BaseTest, TestCase } from "testflow";
import AddMaterial from "../action/material/AddMaterial";
import UpdateMaterial from "../action/material/UpdateMaterial";
import FindLastUserId from "../action/user/FindLastUserId";
import GetOpenId from "../action/user/GetOpenId";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import AddSupplier from "../action/supplier/AddSupplier";

export default class extends TestCase {
  getName(): string {
    return '新建供应商账号'
  }
  buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse({
        name: '新供应商',
        variableType: 'warehouse',
        type: 'supplier'
        
      }),
      new AddSupplier('小杰餐厅',{
        type:'store'
      }),
      new AddMaterial('猪肉', {
        buyUnit: [
          { "name": "瓶" }, { "name": "箱", isSupplier: true, fee: 10 }
        ],
        suppliers: []
      }),
      new AddMaterial('羊肉', {
        suppliers: []
      }),
      new UpdateMaterial('羊肉', {
        suppliers: []
      }),
      new AddMaterial('牛肉', {
        suppliers: []
      })
    ]
  }
}
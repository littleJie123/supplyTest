import { TestCase,ITest, BaseTest } from "testflow";

import FindLastUserId from "../action/user/FindLastUserId";
import GetOpenId from "../action/user/GetOpenId";
import AddSupplier from "../action/supplier/AddSupplier";
import AddMaterial from "../action/material/AddMaterial";

export default class extends TestCase{
  buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddSupplier(),
      new AddMaterial('米醋'),
      new AddMaterial('白酒'),
      new AddMaterial('酱油'),
    ]
  }
  getName(): string {
    return '初始化商品与卖家'
  }
  
}
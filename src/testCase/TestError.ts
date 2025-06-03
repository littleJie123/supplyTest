import { SetVariable, TestCase,ITest, BaseTest } from "testflow"

import AddSupplier from "../action/supplier/AddSupplier"

export default class TestError extends TestCase{
  buildActions(): BaseTest[] {
    return [
      new SetVariable({
        name:'warehouse',
        variable:{
          warehouse:{
            warehouseGroupId:152
          }
        }
      }),
      new AddSupplier()
    ]
  }
  getName(): string {
    return '验证错误'
  }
}
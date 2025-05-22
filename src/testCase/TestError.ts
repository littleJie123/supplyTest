import { SetVariable, TestCase,ITest } from "testflow"

import AddSupplier from "../action/supplier/AddSupplier"

export default class TestError extends TestCase{
  buildActions(): ITest[] {
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
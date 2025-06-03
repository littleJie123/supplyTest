import { BaseTest, ITest, TestCase } from "testflow";
import SetInventory from "../action/inventory/SetInventory";
import ListMaterialAfterInventory from "../action/inventory/ListMaterialAfterInventory";

export default class extends TestCase{
  protected buildActions(): BaseTest[] {
    return [
      new SetInventory(),
      new ListMaterialAfterInventory(),
    ]
  }
  getName(): string {
    return '盘点'
  }
}
import { BaseTest, TestCase } from "testflow";
import SetWarehouse from "../action/warehouse/SetWarehouse";
import ListMaterial from "../action/material/ListMaterial";
import SendNote from "./SendNote";
import CreateFruitNote from "../action/note/CreateFruitNote";

export default class extends TestCase{

  public getName(): string {
    return '多个餐厅发送订单'
  }

  protected buildActions(): BaseTest[] {
    return [
      new SetWarehouse({
        name:'第一家门店',
        variable:{
          warehouse:{
            warehouseId:124,
            warehouseGroupId:139
          }
        }
      }),
      new ListMaterial(),
      new CreateFruitNote(),
      new SetWarehouse({
        name:'需要水果的餐厅',
        variable:{
          warehouse:{
            warehouseId:193,
            warehouseGroupId:1244
          }
        }
      }),
      new ListMaterial(),
      new CreateFruitNote(),
    ]
  }
}
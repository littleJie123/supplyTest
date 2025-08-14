import { CheckUtil } from "testflow";
import Action from "../Action";

export default class extends Action {
  constructor() {
    super({
      name: '切换仓库',
      url: '/app/warehouseGroup/changeWarehouse',
      param: {
        "warehouse": {
          "warehouseGroupId": "${supplierWarehouse.warehouseGroupId}",
          "warehouseId": "${supplierWarehouse.warehouseId}"
        },
        "warehouseGroupId": "${warehouse.warehouseGroupId}"
      },
      headers:{
        token:'${token}'
      }
    })
  }

  protected async  checkResult(result: any): Promise<void> {
    CheckUtil.expectNotNull(result.result?.token);
    CheckUtil.expectEqual(result.result.token.usersId,this.getVariable().usersId);
  }
}
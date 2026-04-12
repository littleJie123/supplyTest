import { CheckUtil } from "testflow";
import Action from "../Action";

export default class ChangeWarehouse extends Action {
  constructor() {
    super({
      name: '切换仓库',
      url: '/app/warehouseGroup/changeWarehouse',
      param: {
        "warehouse": {
          "warehouseGroupId": "${warehouse.warehouseGroupId}",
          "warehouseId": "${warehouse.warehouseId}"
        },
        "warehouseGroupId": "${warehouse.warehouseGroupId}"
      },
      headers: {
        token: '${token}'
      }
    }, {
      buildVariable(result) {
        return {
          token: result.result?.token.token
        }
      }
    })
  }


}
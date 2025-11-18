import { HttpAction } from "testflow";

export default class extends HttpAction {
  constructor() {
    super({
      name:'更新订单',
      method:'post',
      url: '/app/noteItem/updatePurcharse',
      param: {
        "noteId": "${noteMap.供应商1}",
        "noteItems": [
          {
            "noteItemId": "${noteItem.0.noteItemId}",
            "cnt": 300,
            "buyUnitFee": 1,
            "stockUnitsId": 18,
            "price": 21,
            "stockBuyUnitFee": -10,
            "materialId":"${noteItem.0.materialId}"
          },
          {
            "noteItemId": "${noteItem.1.noteItemId}",
            "cnt": 20,
            "buyUnitFee": 500,
            "stockUnitsId": 29,
            "price": 2,
            "stockBuyUnitFee": 500,
            "materialId":"${noteItem.1.materialId}"
          }
        ],
        "warehouseGroupId":'${warehouse.warehouseGroupId}'
      }
    })
  }

  protected async checkResult(result: any): Promise<void> {
    this.checkHttpStatus(result);
    this.expectEqual(result.result.cost,670)
  }
}
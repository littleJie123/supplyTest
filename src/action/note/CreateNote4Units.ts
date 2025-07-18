import { HttpAction, IHttpActionParam } from "testflow";

export default class extends HttpAction {
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name: '改价格测试用订单',
      url: 'http://127.0.0.1:8080/app/note/createNote',
      method: 'POST',
      param: {
        "items": [
          {
            "materialId": 3944,
            "supplierId": 197,
            "cnt": 20,
            "buyUnitFee": 1,
            "stockUnitsId": 5,
            "price": 40,
            "stockBuyUnitFee": -5
          }
        ],
        "warehouseId": 124,
        "warehouseGroupId": 139
      }
    }
  }
}
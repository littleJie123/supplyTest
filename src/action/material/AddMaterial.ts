import { HttpAction, IHttpActionParam } from "testflow";

function createParam(name: string): IHttpActionParam {

  return {
    method:'POST',
    name:'增加商品：'+name,
    url:'/app/material/SaveMaterial',
    param: {
      "buyUnit": [
        { "fee": 1, "name": "ml" }, { "isSupplier": true, "name": "瓶", "fee": 500 }
      ],
      "suppliers": [
        {
          "isDef": true,
          "supplierId": "${supplier.supplierId}",
          "name": "测试供应商",
          "price": 21
        }],
      "img": [],
      "name": name,
      "warehouseId": "${warehouse.warehouseId}",
      "warehouseGroupId": "${warehouse.warehouseGroupId}"
    }
  }

}

export default class extends HttpAction {

  constructor(name) {
    super(createParam(name))

  }

}
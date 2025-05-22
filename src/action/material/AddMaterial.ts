import { HttpAction, IHttpActionParam } from "fasttest";

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
          "supplierId": "${variable.supplier.supplierId}",
          "name": "测试供应商",
          "price": 21
        }],
      "img": [],
      "name": name,
      "warehouseId": "${variable.warehouse.warehouseId}",
      "warehouseGroupId": "${variable.warehouse.warehouseGroupId}"
    }
  }

}

export default class extends HttpAction {

  constructor(name) {
    super(createParam(name))

  }

}
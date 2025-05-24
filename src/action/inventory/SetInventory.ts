import { HttpAction, IHttpActionParam } from "testflow";

export default class extends HttpAction {
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name:'盘点设置库存',
      url: '/app/inventory/setInventory',
      method: 'POST',
      param: {
        "stock": {
          "cnt": 1500,
          "buyUnitFee": 1,
          "stockUnitsId": 53
        },
        "materialId": 3810,
        "material": {
          "materialId": 3810,
          "name": "白酒",
          "pinyin": "baijiu",
          "firstPinyin": "bj",
          "buyUnit": [
            {
              "unitsId": 53,
              "fee": 1,
              "isUnits": true,
              "name": "毫升"
            },
            {
              "unitsId": 18,
              "fee": 500,
              "isSupplier": true,
              "name": "瓶"
            }
          ],
          "unitsId": 53,
          "stockUnitsId": 18,
          "category": {
            "categoryId": 266,
            "name": "无分类"
          },
          "supplier": {
            "supplierId": 167,
            "name": "我的供应商",
            "moa": 0
          },
          "supplierMaterial": {
            "supplierMaterialId": 314,
            "stockUnitsId": 18,
            "price": 21,
            "moc": 0,
            "supplierId": 167,
            "unitsName": "瓶"
          },
          "sysAddTime": "2025-05-22 10:48:39",
          "remark": ""
        },
        "warehouseId": 138,
        "warehouseGroupId": 153
      }
    }
  }
}
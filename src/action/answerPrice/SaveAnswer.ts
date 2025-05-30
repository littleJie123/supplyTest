import { HttpAction, IHttpActionParam } from "testflow";

export default class extends HttpAction {
  protected getDefHttpParam(): IHttpActionParam {
    return {
      method: "POST",
      url: "/app/askPrice/saveAnswer",
      param: {
        "askPriceId": 27,
        "answerItems": [
          {
            "askPriceItemId": 45,
            "price": 120,
            "stockBuyUnitFee": -500,
            "answerPriceItemId": 46,
            "materialId": 3781,
            "money": 1080,
            "secMaterialExts": [
              {
                "materialId": 3781,
                "isDel": 0,
                "extType": "materialNonGmo",
                "numValue": 0,
                "strValue": "true",
                "warehouseGroupId": 139,
                "numValue2": 0,
                "warehouseId": 0,
                "userName": "",
                "tableName": "material",
                "checked": true
              },
              {
                "materialId": 3781,
                "isDel": 0,
                "extType": "materialOrganic",
                "numValue": 0,
                "strValue": "true",
                "warehouseGroupId": 139,
                "numValue2": 0,
                "warehouseId": 0,
                "userName": "",
                "tableName": "material",
                "checked": true
              }
            ]
          },
          {
            "askPriceItemId": 46,
            "price": 14,
            "stockBuyUnitFee": 1,
            "answerPriceItemId": 47,
            "materialId": 3886,
            "money": 140,
            "secMaterialExts": [
              {

                "materialId": 3886,
                "isDel": 0,
                "extType": "materialOrigin",
                "numValue": 0,
                "strValue": "true",
                "warehouseGroupId": 139,
                "numValue2": 0,
                "warehouseId": 0,
                "userName": "",
                "tableName": "material",
                "checked": true
              },
              {

                "materialId": 3886,
                "isDel": 0,
                "extType": "materialBrand",
                "numValue": 0,
                "strValue": "true",
                "warehouseGroupId": 139,
                "numValue2": 0,
                "warehouseId": 0,
                "userName": "",
                "tableName": "material",
                "checked": true
              },
              {

                "materialId": 3886,
                "isDel": 0,
                "extType": "materialNonGmo",
                "numValue": 0,
                "strValue": "true",
                "warehouseGroupId": 139,
                "numValue2": 0,
                "warehouseId": 0,
                "userName": "",
                "tableName": "material",
                "checked": true
              }
            ]
          }
        ],
        "warehouseId": 125,
        "warehouseGroupId": 140
      }
    };
  }
}
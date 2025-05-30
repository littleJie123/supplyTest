"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.HttpAction {
    getDefHttpParam() {
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
exports.default = default_1;

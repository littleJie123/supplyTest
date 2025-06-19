"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.HttpAction {
    getDefHttpParam() {
        return {
            name: '创建水果订单【多餐厅供货用】',
            url: '/app/note/createNote',
            method: 'POST',
            param: {
                "items": [
                    {
                        "materialId": 3919,
                        "supplierId": 197,
                        "cnt": 20,
                        "buyUnitFee": 1,
                        "stockUnitsId": 1,
                        "price": 32,
                        "stockBuyUnitFee": 1
                    },
                    {
                        "materialId": 3918,
                        "supplierId": 197,
                        "cnt": 10,
                        "buyUnitFee": 1,
                        "stockUnitsId": 1,
                        "price": 12,
                        "stockBuyUnitFee": 1
                    }
                ],
                "warehouseId": 124,
                "warehouseGroupId": 139
            }
        };
    }
    getParamMeta() {
        return {
            warehouseId: 'warehouse.warehouseId',
            warehouseGroupId: 'warehouse.warehouseGroupId',
            supplierId: 'supplier.supplierId',
            materialId: [
                'materialMap.车厘子.materialId',
                'materialMap.小番茄.materialId'
            ]
        };
    }
}
exports.default = default_1;

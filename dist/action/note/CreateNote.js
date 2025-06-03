"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.HttpAction {
    getDefHttpParam() {
        return {
            name: '创建订单',
            url: '/app/note/createNote',
            method: 'POST',
            param: {
                "items": [
                    {
                        "materialId": "${materialMap.酱油.materialId}",
                        "supplierId": "${supplier.supplierId}",
                        "cnt": 15000,
                        "buyUnitFee": 1,
                        "stockUnitsId": 18,
                        "price": 21,
                        "stockBuyUnitFee": -500
                    },
                    {
                        "materialId": "${materialMap.米醋.materialId}",
                        "supplierId": "${supplier.supplierId}",
                        "cnt": 10000,
                        "buyUnitFee": 1,
                        "stockUnitsId": 18,
                        "price": 21,
                        "stockBuyUnitFee": -500
                    },
                    {
                        "materialId": "${materialMap.白酒.materialId}",
                        "supplierId": "${supplier.supplierId}",
                        "cnt": 5000,
                        "buyUnitFee": 1,
                        "stockUnitsId": 18,
                        "price": 21,
                        "stockBuyUnitFee": -500
                    }
                ],
                "warehouseId": "${warehouse.warehouseId}",
                "warehouseGroupId": "${warehouse.warehouseGroupId}"
            }
        };
    }
}
exports.default = default_1;

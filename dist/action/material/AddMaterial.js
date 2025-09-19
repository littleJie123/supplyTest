"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
function createParam(name, opt) {
    var _a, _b;
    return {
        method: 'POST',
        name: '增加商品：' + name,
        url: '/app/material/SaveMaterial',
        param: {
            "buyUnit": (_a = opt === null || opt === void 0 ? void 0 : opt.buyUnit) !== null && _a !== void 0 ? _a : [
                { "isSupplier": true, "name": "瓶", "fee": 1 }
            ],
            "suppliers": (_b = opt === null || opt === void 0 ? void 0 : opt.suppliers) !== null && _b !== void 0 ? _b : [
                {
                    "isDef": true,
                    "supplierId": "${supplierMap.供应商1}",
                    "price": 21
                }
            ],
            "img": [],
            "name": name,
            ...getWarehouse(opt)
        }
    };
}
function getWarehouse(opt) {
    var _a;
    let type = (_a = opt === null || opt === void 0 ? void 0 : opt.type) !== null && _a !== void 0 ? _a : 'warehouse';
    if (type === 'warehouse') {
        return {
            "warehouseId": "${warehouse.warehouseId}",
            "warehouseGroupId": "${warehouse.warehouseGroupId}"
        };
    }
    else if (type === 'supplierWarehouse') {
        return {
            "warehouseId": "${supplierWarehouse.warehouseId}",
            "warehouseGroupId": "${supplierWarehouse.warehouseGroupId}"
        };
    }
}
class default_1 extends testflow_1.HttpAction {
    constructor(name, opt) {
        super(createParam(name, opt));
    }
    buildVariable(result) {
        return {
            lastMaterialId: result.result.materialId
        };
    }
}
exports.default = default_1;

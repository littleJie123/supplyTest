"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fasttest_1 = require("fasttest");
function createParam(name) {
    return {
        method: 'POST',
        name: '增加商品：' + name,
        url: '/app/material/SaveMaterial',
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
                }
            ],
            "img": [],
            "name": name,
            "warehouseId": "${variable.warehouse.warehouseId}",
            "warehouseGroupId": "${variable.warehouse.warehouseGroupId}"
        }
    };
}
class default_1 extends fasttest_1.HttpAction {
    constructor(name) {
        super(createParam(name));
    }
}
exports.default = default_1;

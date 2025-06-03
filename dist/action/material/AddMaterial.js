"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
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
                    "supplierId": "${supplier.supplierId}",
                    "name": "测试供应商",
                    "price": 21
                }
            ],
            "img": [],
            "name": name,
            "warehouseId": "${warehouse.warehouseId}",
            "warehouseGroupId": "${warehouse.warehouseGroupId}"
        }
    };
}
class default_1 extends testflow_1.HttpAction {
    constructor(name) {
        super(createParam(name));
    }
}
exports.default = default_1;

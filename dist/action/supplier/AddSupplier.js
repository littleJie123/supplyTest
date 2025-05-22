"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fasttest_1 = require("fasttest");
class AddSupplier extends fasttest_1.HttpAction {
    getDefHttpParam() {
        return {
            name: '增加卖家',
            method: 'POST',
            url: '/app/supplier/addsupplier',
            param: {
                "name": "我的供应商",
                "warehouseGroupId": "${variable.warehouse.warehouseGroupId}"
            }
        };
    }
    buildVariable(result) {
        return {
            supplier: result.result
        };
    }
}
exports.default = AddSupplier;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class AddSupplier extends testflow_1.HttpAction {
    getDefHttpParam() {
        return {
            name: '增加卖家',
            method: 'POST',
            url: '/app/supplier/addsupplier',
            param: {
                "name": "我的供应商",
                "warehouseGroupId": "${warehouse.warehouseGroupId}"
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

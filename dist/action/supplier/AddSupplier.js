"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class AddSupplier extends testflow_1.HttpAction {
    constructor(name) {
        super({
            name: '增加卖家:' + name,
            method: 'POST',
            url: '/app/supplier/addsupplier',
            param: {
                "name": name,
                "warehouseGroupId": "${warehouse.warehouseGroupId}"
            }
        });
        this.name = name;
    }
    buildVariable(result) {
        return {
            supplier: result.result
        };
    }
}
exports.default = AddSupplier;

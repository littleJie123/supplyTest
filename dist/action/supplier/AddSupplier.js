"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class AddSupplier extends testflow_1.HttpAction {
    constructor(name, opt) {
        var _a, _b;
        super({
            name: '增加卖家:' + name,
            method: 'POST',
            url: '/app/supplier/addsupplier',
            param: {
                "name": name,
                "warehouseGroupId": `\${${(_a = opt === null || opt === void 0 ? void 0 : opt.warehouseType) !== null && _a !== void 0 ? _a : 'warehouse'}.warehouseGroupId}`,
                type: (_b = opt === null || opt === void 0 ? void 0 : opt.type) !== null && _b !== void 0 ? _b : 'supplier'
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

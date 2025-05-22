"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.HttpAction {
    getDefHttpParam() {
        return {
            name: '查询订单商品列表',
            url: '/app/note/listNote',
            method: 'POST',
            param: {
                supplierId: "${variable.supplier.supplierId}",
                warehouseId: "${variable.warehouse.warehouseId}",
                status: "normal",
                warehouseGroupId: "${variable.warehouse.warehouseGroupId}",
            }
        };
    }
    buildVariable(result) {
        return {
            note: result.result.content[0],
        };
    }
}
exports.default = default_1;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.HttpAction {
    constructor() {
        super({
            name: '获取商品',
            url: '/app/material/listMaterialByCategory',
            method: 'POST',
            param: {
                warehouseGroupId: '${warehouse.warehouseGroupId}',
                warehouseId: '${warehouse.warehouseId}'
            }
        });
    }
    buildVariable(result) {
        let content = result.result.content;
        let materialMap = {};
        for (let row of content) {
            materialMap[row.name] = row;
        }
        return {
            materialMap
        };
    }
}
exports.default = default_1;

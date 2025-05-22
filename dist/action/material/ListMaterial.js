"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fasttest_1 = require("fasttest");
class default_1 extends fasttest_1.HttpAction {
    constructor() {
        super({
            name: '获取商品',
            url: '/app/material/listMaterialByCategory',
            method: 'POST',
            param: {
                warehouseGroupId: '${variable.warehouse.warehouseGroupId}',
                warehouseId: '${variable.warehouse.warehouseId}'
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

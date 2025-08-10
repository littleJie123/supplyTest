"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
/**
 * 查询出物料，并且把物料放到materialMap中
 */
class default_1 extends testflow_1.HttpAction {
    constructor(opt) {
        super({
            name: '获取商品',
            url: '/app/material/listMaterialByCategory',
            method: 'POST',
            param: {
                warehouseGroupId: '${warehouse.warehouseGroupId}',
                warehouseId: '${warehouse.warehouseId}'
            }
        });
        this.testOpt = opt;
    }
    buildVariable(result) {
        let content = result.result.content;
        let materialMap = {};
        for (let row of content) {
            materialMap[row.name] = {
                materialId: row.materialId
            };
        }
        return {
            materialMap
        };
    }
    async checkResult(result) {
        let opt = this.testOpt;
        if (opt) {
            let content = result.result.content;
            if (opt.hasPurcharse) {
                let purcharses = content.filter(row => row.purcharse != null);
                this.expectEqual(purcharses.length, opt.hasPurcharse);
            }
        }
    }
}
exports.default = default_1;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.HttpAction {
    getDefHttpParam() {
        return {
            name: '盘点后查询物料',
            url: '/app/material/listMaterialByCategory',
            method: 'POST',
            param: {
                "materialId": [3810],
                "warehouseId": 138,
                "warehouseGroupId": 153
            }
        };
    }
    getParamMeta() {
        return {
            warehouseId: 'warehouse.warehouseId',
            warehouseGroupId: 'warehouse.warehouseGroupId',
        };
    }
}
exports.default = default_1;

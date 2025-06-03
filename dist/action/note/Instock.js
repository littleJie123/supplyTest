"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.HttpAction {
    getDefHttpParam() {
        return {
            name: '确认订单',
            url: '/app/note/instock',
            method: 'POST',
        };
    }
    getHttpParam() {
        let items = [];
        let noteItem = this.getVariable()['noteItem'];
        for (let i = 0; i < noteItem.length; i++) {
            let row = noteItem[i];
            items.push({
                "noteItemId": row.noteItemId,
                "cnt": row.purcharse.cnt,
                "buyUnitFee": row.purcharse.buyUnitFee,
                "price": row.supplierMaterial.price,
                "stockUnitsIds": row.stockUnitsId,
                "materialId": row.materialId,
                "stockBuyUnitFee": row.supplierMaterial.buyUnitFee
            });
        }
        return {
            "warehouseId": "${warehouse.warehouseId}",
            "noteId": "${note.noteId}",
            "items": items,
            "warehouseGroupId": "${warehouse.warehouseGroupId}",
        };
    }
}
exports.default = default_1;

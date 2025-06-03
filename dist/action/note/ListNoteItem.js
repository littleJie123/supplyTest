"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.HttpAction {
    getDefHttpParam() {
        return {
            name: '查询订单明细',
            url: '/app/noteItem/listNoteItem',
            method: 'GET',
            param: {
                noteId: "${note.noteId}",
                warehouseGroupId: "${warehouse.warehouseGroupId}",
            }
        };
    }
    buildVariable(result) {
        return {
            noteItem: result.result.content,
        };
    }
}
exports.default = default_1;

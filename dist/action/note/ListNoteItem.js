"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fasttest_1 = require("fasttest");
class default_1 extends fasttest_1.HttpAction {
    getDefHttpParam() {
        return {
            name: '查询订单明细',
            url: '/app/noteItem/listNoteItem',
            method: 'GET',
            param: {
                noteId: "${variable.note.noteId}",
                warehouseGroupId: "${variable.warehouse.warehouseGroupId}",
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

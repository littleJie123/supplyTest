"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fasttest_1 = require("fasttest");
const TestReg_1 = __importDefault(require("./TestReg"));
const ListMaterial_1 = __importDefault(require("../action/material/ListMaterial"));
const CreateNote_1 = __importDefault(require("../action/note/CreateNote"));
const ListNote_1 = __importDefault(require("../action/note/ListNote"));
const ListNoteItem_1 = __importDefault(require("../action/note/ListNoteItem"));
const Instock_1 = __importDefault(require("../action/note/Instock"));
class default_1 extends fasttest_1.TestCase {
    buildActions() {
        return [
            new TestReg_1.default(),
            new ListMaterial_1.default(),
            new CreateNote_1.default(),
            new ListNote_1.default(),
            new ListNoteItem_1.default(),
            new Instock_1.default()
        ];
    }
    getName() {
        return "确认订单";
    }
}
exports.default = default_1;

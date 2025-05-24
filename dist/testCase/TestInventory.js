"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
const SetInventory_1 = __importDefault(require("../action/inventory/SetInventory"));
const ListMaterialAfterInventory_1 = __importDefault(require("../action/inventory/ListMaterialAfterInventory"));
class default_1 extends testflow_1.TestCase {
    buildActions() {
        return [
            new SetInventory_1.default(),
            new ListMaterialAfterInventory_1.default(),
        ];
    }
    getName() {
        return '盘点';
    }
}
exports.default = default_1;

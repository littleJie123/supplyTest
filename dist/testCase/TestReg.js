"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
const FindLastUserId_1 = __importDefault(require("../action/user/FindLastUserId"));
const GetOpenId_1 = __importDefault(require("../action/user/GetOpenId"));
const AddSupplier_1 = __importDefault(require("../action/supplier/AddSupplier"));
const AddMaterial_1 = __importDefault(require("../action/material/AddMaterial"));
class default_1 extends testflow_1.TestCase {
    buildActions() {
        return [
            new FindLastUserId_1.default(),
            new GetOpenId_1.default(),
            new AddSupplier_1.default(),
            new AddMaterial_1.default('米醋'),
            new AddMaterial_1.default('白酒'),
            new AddMaterial_1.default('酱油'),
        ];
    }
    getName() {
        return '初始化商品与卖家';
    }
}
exports.default = default_1;

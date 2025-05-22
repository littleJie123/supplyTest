"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
const AddSupplier_1 = __importDefault(require("../action/supplier/AddSupplier"));
class TestError extends testflow_1.TestCase {
    buildActions() {
        return [
            new testflow_1.SetVariable({
                name: 'warehouse',
                variable: {
                    warehouse: {
                        warehouseGroupId: 152
                    }
                }
            }),
            new AddSupplier_1.default()
        ];
    }
    getName() {
        return '验证错误';
    }
}
exports.default = TestError;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
const SetWarehouse_1 = __importDefault(require("../action/warehouse/SetWarehouse"));
const ListMaterial_1 = __importDefault(require("../action/material/ListMaterial"));
const CreateFruitNote_1 = __importDefault(require("../action/note/CreateFruitNote"));
class default_1 extends testflow_1.TestCase {
    getName() {
        return '一个餐厅发送订单';
    }
    buildActions() {
        return [
            new SetWarehouse_1.default({
                name: '第一家门店',
                variable: {
                    warehouse: {
                        warehouseId: 124,
                        warehouseGroupId: 139
                    }
                }
            }),
            new ListMaterial_1.default(),
            new CreateFruitNote_1.default()
        ];
    }
}
exports.default = default_1;

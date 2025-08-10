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
const AddWarehouse_1 = __importDefault(require("../action/warehouse/AddWarehouse"));
const ListSupplier_1 = __importDefault(require("../action/supplier/ListSupplier"));
const UpdateMaterial_1 = __importDefault(require("../action/material/UpdateMaterial"));
const GetMaterialInfo_1 = __importDefault(require("../action/material/GetMaterialInfo"));
const UpdateMaterial2_1 = __importDefault(require("../action/material/UpdateMaterial2"));
class default_1 extends testflow_1.TestCase {
    buildActions() {
        return [
            new FindLastUserId_1.default(),
            new GetOpenId_1.default(),
            new AddWarehouse_1.default(),
            new AddSupplier_1.default('供应商1'),
            new AddSupplier_1.default('供应商2'),
            new ListSupplier_1.default(),
            new AddMaterial_1.default('猪肉'),
            new UpdateMaterial_1.default('猪肉'),
            new GetMaterialInfo_1.default({
                buyUnitFee: 500,
                price: 0.2
            }),
            new AddMaterial_1.default('羊肉'),
            new UpdateMaterial2_1.default('羊肉'),
            new GetMaterialInfo_1.default({
                buyUnitFee: -10,
                price: 200
            }, '供应商2'),
            new UpdateMaterial2_1.default('羊肉', true),
            new GetMaterialInfo_1.default({
                buyUnitFee: -10,
                price: 150
            }, '供应商1', 1),
        ];
    }
    getName() {
        return '物料逻辑';
    }
}
exports.default = default_1;

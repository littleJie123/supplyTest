"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.HttpAction {
    getDefHttpParam() {
        return {
            url: '/app/usersWarehouse/restoreUsersWarehouse',
            method: 'post',
            name: '恢复用户',
            param: {
                usersId: 130,
                //warehouseGroupId:0,
                data: {
                    warehouseId: 170,
                    usersId: 108
                }
            }
        };
    }
}
exports.default = default_1;

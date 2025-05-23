"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.UrlAction {
    getHttpUrl() {
        return '/free/findLastUser';
    }
    buildVariable(result) {
        let openid = result.result.openid;
        let num = openid.substring('_test'.length);
        return {
            openid: `_test${parseInt(num) + 1}`,
        };
    }
    getName() {
        return '查找最大用户id';
    }
}
exports.default = default_1;

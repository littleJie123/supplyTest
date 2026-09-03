"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class default_1 extends testflow_1.UrlAction {
    getHttpUrl() {
        return '/free/findMaxTestUser';
    }
    buildVariable(result) {
        let openid = result.result.openid;
        return {
            openid: `_test${openid + 1}`,
        };
    }
    getName() {
        return '查找最大用户id';
    }
}
exports.default = default_1;

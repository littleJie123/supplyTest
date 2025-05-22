"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class GetOpenId extends testflow_1.UrlAction {
    getMethod() {
        return 'GET';
    }
    getHttpUrl() {
        return '/free/getOpenId?code=${variable.openid}';
    }
    buildVariable(result) {
        return {
            warehouse: result.result.warehouse
        };
    }
    getName() {
        return '注册用户';
    }
}
exports.default = GetOpenId;

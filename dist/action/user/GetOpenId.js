"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testflow_1 = require("testflow");
class GetOpenId extends testflow_1.UrlAction {
    getMethod() {
        return 'GET';
    }
    getHttpUrl() {
        return '/free/getOpenId?code=${openid}';
    }
    buildVariable(result) {
        return {
            usersId: result.result.token.usersId,
            warehouse: result.result.warehouse,
            token: result.result.token.token
        };
    }
    getName() {
        return '注册用户';
    }
}
exports.default = GetOpenId;

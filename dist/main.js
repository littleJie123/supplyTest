"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fasttest_1 = require("fasttest");
const path_1 = __importDefault(require("path"));
const runner = fasttest_1.TestRunner.get();
runner.regEnvConfig('local', {
    host: 'http://127.0.0.1:8080/'
});
let testId = null;
if (process.argv.length > 2) {
    testId = process.argv[2];
}
runner.start({
    testPath: path_1.default.join(__dirname, './testCase'),
    testId: testId
});

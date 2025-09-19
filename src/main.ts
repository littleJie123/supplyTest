import { TestRunner } from "testflow";
import path from "path";
const runner = TestRunner.get();
runner.regEnvConfig('local',{
  host:'http://127.0.0.1:8080/'
})

runner.start({
  testPath:path.join(__dirname,'./testCase'),


})
import { TestRunner } from "testflow";
import path from "path";
const runner = TestRunner.get();
runner.regEnvConfig('local',{
  host:'http://127.0.0.1:8080/'
})
let testId = null;
if(process.argv.length > 2){
  testId = process.argv[2];
}
runner.start({
  testPath:path.join(__dirname,'./testCase'),
  actionPath:path.join(__dirname,'./action'),
  testId:testId

})
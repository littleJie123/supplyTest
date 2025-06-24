import { BaseTest, TestCase } from "testflow";

class TestAction extends BaseTest {
  getName(): string {
    return 'TestAction';
  }
  protected async doTest(): Promise<any> {
    console.log('WebSocket测试用例执行中...');
  }
  
}


export default class extends TestCase{
  protected buildActions(): BaseTest[] {
    return [
      new TestAction()
    ]
  }
  getName(): string {
    return 'WebSocket测试用例';
  }
  
}
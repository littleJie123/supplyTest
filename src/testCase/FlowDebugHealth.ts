import { TestCase, BaseTest, HttpAction } from "testflow";
import Action from "../action/Action";

export default class extends TestCase {
  getName(): string {
    return 'debughealth'
  }
  protected buildActions(): BaseTest[] {
    return [
      new HttpAction({
        name: 'debugHealth',
        url: '/debug/health',
        method: 'GET',

      })
    ]
  }
}
import { HttpAction, IAfterProcess } from "testflow";

interface AdminQueryOpt {
  url: string;
  name?: string;
  method?: string;
  query?: any;
  len?: number;
  verify?: (content: any[]) => void;
}

export default class AdminQueryAction extends HttpAction {
  private testOpt: AdminQueryOpt;

  constructor(opt: AdminQueryOpt, afterProcess?: IAfterProcess) {
    super({
      url: opt.url,
      name: opt.name ?? '查询接口',
      method: opt.method,
      param: opt.query ?? {},
    }, afterProcess);
    this.testOpt = opt;
  }

  protected async checkResult(result: any): Promise<void> {
    await super.checkResult(result);
    let content = result.result.content;
    if (this.testOpt.len != null) {
      this.expectEqual(content.length, this.testOpt.len);
    }
    if (this.testOpt.verify) {
      this.testOpt.verify(content);
    }
  }
}

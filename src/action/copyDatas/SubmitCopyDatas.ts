import { CheckUtil, HttpAction } from "testflow";

/**
 * 循环调用 /admin/copyDatas/submitCopyDatas，直到该表 isFinish。
 */
export default class SubmitCopyDatas extends HttpAction {
  private beginId: number = null;
  private tableName: string;

  constructor(tableName: string) {
    super({
      name: `同步表${tableName}`,
      remark: `循环 submitCopyDatas，直到 ${tableName} 完成`,
      url: '/admin/copyDatas/submitCopyDatas',
      param: {
        copyNo: '${copyNo}',
        tableName,
        src: {
          warehouseId: '${warehouse.warehouseId}'
        },
        target: {
          warehouseId: '${warehouse2.warehouseId}',
          env: 'local'
        }
      }
    }, {
      check(result) {
        let ret = result.result;
        CheckUtil.expectEqual(ret.status, 'succ', `${tableName}同步失败:${ret.message}`);
        CheckUtil.expectEqual(ret.isFinish, true, `${tableName}应同步完成`);
      }
    });
    this.tableName = tableName;
  }

  protected getHttpParam() {
    let param = super.getHttpParam();
    if (this.beginId != null) {
      param.beginId = this.beginId;
    }
    return param;
  }

  protected parseHttpParam() {
    let ret = super.parseHttpParam();
    if (this.env != null) {
      ret.target.env = this.env;
    }
    return ret;
  }

  protected async doTest(): Promise<any> {
    this.beginId = null;
    let last: any = null;
    for (let i = 0; i < 20; i++) {
      last = await super.doTest();
      this.checkHttpStatus(last);
      if (last?.result?.status != 'succ') {
        return last;
      }
      if (last?.result?.isFinish) {
        return last;
      }
      this.beginId = last.result.nextBeginId;
    }
    throw new Error(`${this.tableName} 超过最大分页次数`);
  }
}

import { CheckUtil, HttpAction, JsonUtil } from "testflow";

type InsertApi = 'insertCopyDatas' | 'insertUnitsCopyDatas' | 'insertBuyUnitDatas';

/**
 * 查询 /admin/copyDatas/submitCopyDatas，再插入目标环境对应接口，直到该表 isFinish。
 * 业务表走 insertCopyDatas（带 srcEnv）；units / buyUnit 走 insertUnitsCopyDatas / insertBuyUnitDatas。
 * 每批插入后调用 /admin/copyResult/addResult 追加记录。
 */
export default class SubmitCopyDatas extends HttpAction {
  private beginId: number = null;
  private tableName: string;
  private checkEmptyBrand: boolean;
  private insertApi: InsertApi;

  constructor(tableName: string, checkEmptyBrand?: boolean, insertApi?: InsertApi) {
    super({
      name: `同步表${tableName}`,
      remark: insertApi != null && insertApi !== 'insertCopyDatas'
        ? `查询 ${tableName}，再 ${insertApi}，直到完成`
        : `查询 ${tableName} 并 insertCopyDatas 插入目标仓（带 srcEnv），每批写入 copyResult，直到完成`,
      url: '/admin/copyDatas/submitCopyDatas',
      param: {
        tableName,
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(result.result.isFinish, true, `${tableName}应同步完成`);
      }
    });
    this.tableName = tableName;
    this.checkEmptyBrand = checkEmptyBrand === true;
    this.insertApi = insertApi ?? 'insertCopyDatas';
  }

  protected getHttpParam() {
    let param = super.getHttpParam();
    if (this.beginId != null) {
      param.beginId = this.beginId;
    }
    return param;
  }

  protected async doTest(): Promise<any> {
    this.beginId = null;
    let last: any = null;
    let insertedCnt = 0;
    for (let i = 0; i < 20; i++) {
      last = await super.doTest();
      this.checkHttpStatus(last);
      let ret = last?.result;
      let datas = ret?.datas ?? [];
      let needInsert = datas.length > 0 || (this.checkEmptyBrand && this.beginId == null);
      if (needInsert) {
        try {
          await this.insertToTarget(datas);
          insertedCnt += datas.length;
          await this.addCopyResult('succ', datas.length, insertedCnt, '导入成功');
        } catch (e) {
          await this.addCopyResult('fail', datas.length, insertedCnt, e instanceof Error ? e.message : '导入失败');
          throw e;
        }
      }
      if (ret?.isFinish) {
        return last;
      }
      this.beginId = ret.nextBeginId;
    }
    throw new Error(`${this.tableName} 超过最大分页次数`);
  }

  private getSrcEnv(): string {
    return this.env ?? 'local';
  }

  private async insertToTarget(datas: any[]) {
    let insertUrl = this.parseHttpUrl().replace(
      '/admin/copyDatas/submitCopyDatas',
      `/free/copyDatas/${this.insertApi}`
    );
    let insertParam: any = {
      datas,
      srcEnv: this.getSrcEnv()
    };
    if (this.insertApi === 'insertCopyDatas') {
      insertParam = JsonUtil.parseJson({
        tableName: this.tableName,
        warehouseId: '${warehouse2.warehouseId}',
        copyNo: '${copyNo}',
        srcEnv: this.getSrcEnv()
      }, this.getVariable());
      insertParam.datas = datas;
      if (this.checkEmptyBrand && this.beginId == null) {
        insertParam.checkEmptyBrand = true;
      }
    }
    let headers = this.parseHttpHeaders();
    let insertWrap = await this.submit(insertUrl, insertParam, headers);
    this.sendMsg('httpParam', {
      id: this.getTestId(),
      url: insertUrl,
      param: insertParam,
      headers,
      result: insertWrap,
      method: 'POST'
    });
    this.httpStatus = insertWrap.status;
    this.checkHttpStatus(insertWrap.result);
    let insertRet = insertWrap.result?.result ?? insertWrap.result;
    CheckUtil.expectEqual(insertRet.status, 'succ', `${this.tableName}导入失败:${insertRet?.message}`);
  }

  private async addCopyResult(status: string, batchCnt: number, insertedCnt: number, message: string) {
    let url = this.parseHttpUrl().replace(
      '/admin/copyDatas/submitCopyDatas',
      '/admin/copyResult/addResult'
    );
    let param: any = JsonUtil.parseJson({
      copyNo: '${copyNo}',
      tableName: this.tableName,
      status,
      srcEnv: this.getSrcEnv(),
      srcWarehouseId: '${warehouse.warehouseId}',
      targetEnv: this.env ?? 'local',
      targetWarehouseId: '${warehouse2.warehouseId}',
      batchCnt,
      insertedCnt,
      message
    }, this.getVariable());
    let headers = this.parseHttpHeaders();
    let wrap = await this.submit(url, param, headers);
    this.sendMsg('httpParam', {
      id: this.getTestId(),
      url,
      param,
      headers,
      result: wrap,
      method: 'POST'
    });
    this.httpStatus = wrap.status;
    this.checkHttpStatus(wrap.result);
  }
}

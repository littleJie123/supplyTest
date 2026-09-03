import { CheckUtil, HttpAction, IHttpActionParam, JsonUtil } from 'testflow';

interface Opt {
  noteId: string;
  materialId: string;
  name?: string;
  remark?: string;
  expectedStatus?: number;
  expectedMessage?: string;
  cnt?: number;
  price?: number;
  buyUnitFee?: number;
  stockBuyUnitFee?: number;
  expectedResult?: any;
}

export default class extends HttpAction {
  private expectedMessage?: string;
  private expectedResult?: any;

  constructor(opt: Opt) {
    const param: IHttpActionParam = {
      name: opt.name ?? '已入库订单新增物料失败',
      remark: opt.remark ?? '订单新增物料',
      url: '/app/note/addMaterial2Note',
      method: 'post',
      exceptHttpStatus: opt.expectedStatus ?? 200,
      param: {
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        noteId: opt.noteId,
        material: {
          materialId: opt.materialId,
          cnt: opt.cnt ?? 1,
          price: opt.price ?? 10,
          buyUnitFee: opt.buyUnitFee ?? 1,
          stockBuyUnitFee: opt.stockBuyUnitFee ?? 1
        }
      }
    };
    super(param);
    this.expectedMessage = opt.expectedMessage;
    this.expectedResult = opt.expectedResult;
  }

  protected async checkResult(result: any): Promise<void> {
    await super.checkResult(result);
    if (this.expectedMessage != null) {
      CheckUtil.expectEqual(
        result?.error?.message,
        this.expectedMessage,
        `${this.getName()}错误信息不正确`
      );
    }
    if (this.expectedResult != null) {
      const expectedResult = JsonUtil.parseJson(this.expectedResult, this.getVariable());
      const actualResult = result?.result ?? result;
      CheckUtil.expectFind([actualResult], expectedResult, `${this.getName()}返回值不正确`);
    }
  }
}

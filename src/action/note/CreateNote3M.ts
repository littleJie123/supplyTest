import { url } from "inspector";
import { ArrayUtil, BaseTest, HttpAction, TestCase } from "testflow";
import Action from "../Action";
interface TestOpt {
  items?: any[]
  /**
   * 检查的notes
   */
  checkNotes?: any[]
  /**
   * 不要创建变量
   */
  noBuildSupplier?: boolean;

  supplier?: string;

  /**
   * 价格比例
   */
  priceFee?:number

  sendNote?: {
    status?: 'normal' | 'accept'
  }
  /**
   * 不要检查
   */
  notCheck?:boolean;

  cntMap?:any
}
function createParam(opt: TestOpt) {
  let priceFee = opt.priceFee ?? 1;
  let cntMap = opt.cntMap;
  return {
    name: '下单3个物料',
    url: '/app/note/createNote',
    method: 'post',
    param: {
      "items": opt?.items ?? [
        {
          "materialId": '${materialMap.牛肉.materialId}',
          "supplierId": opt.supplier ?? '${supplierMap.供应商2}',
          "cnt":cntMap?.牛肉 ?? 50 ,
          "buyUnitFee": 1,
          "stockUnitsId": 18,
          "price": 10*priceFee,
          "stockBuyUnitFee": 1
        },
        {
          "materialId": '${materialMap.猪肉.materialId}',
          "supplierId": opt.supplier ?? '${supplierMap.供应商1}',
          "cnt": cntMap?.猪肉 ?? 400,
          "buyUnitFee": 1,
          "stockUnitsId": 5,
          "price": 21*priceFee,
          "stockBuyUnitFee": -10
        },
        {
          "materialId": '${materialMap.羊肉.materialId}',
          "supplierId": opt.supplier ?? '${supplierMap.供应商1}',
          "cnt": cntMap?.羊肉 ?? 30,
          "buyUnitFee": 500,
          "stockUnitsId": 29,
          "price": 0.2*priceFee,
          "stockBuyUnitFee": 500
        }
      ],
      "warehouseId": '${warehouse.warehouseId}',
      "warehouseGroupId": '${warehouse.warehouseGroupId}'
    }
  }
}

export default class extends TestCase {
  testOpt: TestOpt;
  constructor(testOpt?: TestOpt) {
    super()
    if (testOpt == null) {
      testOpt = {};
    }
    this.testOpt = testOpt
  }
  protected buildActions(): BaseTest[] {
    return [
      new CreateNote(this.testOpt),
      new Action({
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: this.testOpt.sendNote?.status ?? 'normal'
        }
      })
    ]
  }

  getName(): string {
    return '下单3个物料'
  }
}
/**
 * 下单3个物料
 */
class CreateNote extends HttpAction {
  private testOpt: TestOpt
  constructor(opt?: TestOpt) {

    super(createParam(opt));
    this.testOpt = opt;
  }


  protected buildVariable(result: any) {
    let ret: any = {}
    let content: any[] = result.result;
    if (!this.testOpt.noBuildSupplier) {

      let supplier1 = content.find(row => row.supplierName == '供应商1');
      let supplier2 = content.find(row => row.supplierName == '供应商2');

      ret.noteMap = {
        '供应商1': supplier1?.noteId,
        '供应商2': supplier2?.noteId
      }


    }
    ret.noteIds = ArrayUtil.toArray(content, 'noteId')
    return ret;
  }

  protected getCheckNotes(): any[] {
    let ret = this.testOpt?.checkNotes;
    if (ret == null) {
      ret = [
        {
          materialCnt: 2,
          cost: 846
        }, {
          materialCnt: 1,
          cost: 500
        }
      ]
    }
    return ret;
  }

  protected async checkResult(result: any): Promise<void> {
    let content: any[] = result.result;
    if(!this.testOpt.notCheck){
      let notes: any[] = this.getCheckNotes()
      if (notes != null) {
        for (let note of notes) {
          this.expectFind(content, note)
        }
      }
    }

  }
}
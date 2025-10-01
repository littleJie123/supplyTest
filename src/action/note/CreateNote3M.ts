import { HttpAction } from "testflow";
interface TestOpt{
  items?:any[]
  /**
   * 检查的notes
   */
  checkNotes?:any[]
  /**
   * 不要创建变量
   */
  noBuildSupplier?:boolean;

  supplier?:string;
}
function createParam(opt:TestOpt){
  return {
      name:'下单3个物料',
      url:'/app/note/createNote',
      method:'post',
      param: {
        "items": opt?.items ?? [
          {
            "materialId": '${materialMap.牛肉.materialId}',
            "supplierId": opt.supplier ?? '${supplierMap.供应商2}',
            "cnt": 50,
            "buyUnitFee": 1,
            "stockUnitsId": 18,
            "price": 10,
            "stockBuyUnitFee": 1
          },
          {
            "materialId": '${materialMap.猪肉.materialId}',
            "supplierId": opt.supplier ?? '${supplierMap.供应商1}',
            "cnt": 400,
            "buyUnitFee": 1,
            "stockUnitsId": 5,
            "price": 21,
            "stockBuyUnitFee": -10
          },
          {
            "materialId": '${materialMap.羊肉.materialId}',
            "supplierId":  opt.supplier ?? '${supplierMap.供应商1}',
            "cnt": 30,
            "buyUnitFee": 500,
            "stockUnitsId": 29,
            "price": 0.2,
            "stockBuyUnitFee": 500
          }
        ],
        "warehouseId": '${warehouse.warehouseId}',
        "warehouseGroupId": '${warehouse.warehouseGroupId}'
      }
    }
}
/**
 * 下单3个物料
 */
export default class extends HttpAction {
  private testOpt:TestOpt
  constructor(opt?:TestOpt) {
    if(opt == null){
      opt = {};
    }
    super(createParam(opt));
    this.testOpt = opt;
  }


  protected buildVariable(result: any) {
    if(!this.testOpt.noBuildSupplier){
      let content:any[] = result.result;
      let supplier1 = content.find(row=>row.supplierName=='供应商1');
      let supplier2 = content.find(row=>row.supplierName=='供应商2');
      return {
        noteMap:{
          '供应商1':supplier1?.noteId,
          '供应商2':supplier2?.noteId
        }
      }
    }
  }

  protected getCheckNotes():any[]{
    let ret = this.testOpt?.checkNotes;
    if(ret == null ){
      ret = [ 
        {
          materialCnt:2,
          cost:846
        },{
          materialCnt:1,
          cost:500
        }
      ]
    }
    return ret;
  }

  protected async checkResult(result: any): Promise<void> {
    let content:any[] = result.result;
    let notes:any[] = this.getCheckNotes()
    if(notes != null){
      for(let note of notes){
        this.expectFind(content,note)
      }
    }

  }
}
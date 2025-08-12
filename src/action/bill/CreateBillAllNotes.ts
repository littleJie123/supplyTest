import { HttpAction } from "testflow";

interface TestOpt{
  len?:number;
  bills?:any[]
}
export default class extends HttpAction{
  private testOpt:TestOpt;
  constructor(opt?:TestOpt){
    super({
      name:'结算订单',
      url:'/app/bill/createBill',
      param:{
        warehouseGroupId: "${warehouse.warehouseGroupId}",
        warehouseId: "${warehouse.warehouseGroupId}"
      }
    })
    this.testOpt = opt;


  }
  protected parseHttpParam() {
    let variable = this.getVariable();
    let notes:any[] = variable.notes;
    let noteId = notes.map(row=>row.noteId);
    let param = super.parseHttpParam();
    param.noteId = noteId;
    return param;
  }

  protected async checkResult(result: any): Promise<void> {
    await super.checkResult(result);
    let opt = this.testOpt;
    let content = result.result;
    if(opt?.len != null){
      this.expectEqual(content.length,opt.len)
    } 
    if(opt?.bills != null){
      for(let bill of opt.bills){
        this.expectFind(content,bill)
      }
    }
  }

  protected buildVariable(result: any) {
    let content:any[]=result.result;
    return {
      billIds:content.map(row=>row.billId)
    }
  }


}
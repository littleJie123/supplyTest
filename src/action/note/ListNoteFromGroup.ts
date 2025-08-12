import { ArrayUtil, HttpAction, IHttpActionParam } from "testflow";

interface Opt {
  notes?:any[]
}
function create(opt:Opt): IHttpActionParam {
  return {
    name:'根据noteGroup的结果查询订单',
    url:'/app/note/listNote',
    method:'POST',
    param:{
      status: "${noteGroup.status}", 
      warehouseId: "${warehouse.warehouseId}", 
      warehouseGroupId:"${warehouse.warehouseGroupId}",
      day:'${noteGroup.day}',
      needLinkStatue:true

    }
  }
}
export default class extends HttpAction{
  private testOpt:Opt = null;
  constructor(opt:Opt){
    super(create(opt));
    this.testOpt = opt;
  }

  protected async checkResult(result: any): Promise<void> {
    let content:any[] = result.result.content;
    if(this.testOpt.notes){
      for(let note of this.testOpt.notes){
        this.expectFind(content,note);
      }
    }
  }

  protected buildVariable(result: any) {
    let content:any[] = result.result.content;
    
    return {
      notes:content,
      supplierName:ArrayUtil.toMapByKey(content,'supplierName','noteId')


    }
  }

  
}
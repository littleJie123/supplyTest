import { HttpAction, IHttpActionParam } from "testflow";

interface Opt{
  supplierName?:string;
  len?:number;
}
function create(opt:Opt):IHttpActionParam{
  return {
    name:'查询订单物料：'+opt.supplierName,
    url:'/app/noteItem/listNoteItem',
    param:{
      noteId:'${noteMap.'+opt.supplierName+'}',
      warehouseGroupId:'${warehouse.warehouseGroupId}'
    }
  }
}
export default class extends HttpAction{
  private testOpt:Opt;
  constructor(opt:Opt){
    if(opt == null){
      opt = {}
    }
    super(create(opt))
    this.testOpt = opt;
  }
  protected async checkResult(result: any): Promise<void> {
    let opt = this.testOpt;
    if(opt.len != null){
      this.expectEqual(result.result.content.length,opt.len)
    }
  }

  protected buildVariable(result: any) {
   
    return {
      noteItem: result.result.content,
    }
  }
}
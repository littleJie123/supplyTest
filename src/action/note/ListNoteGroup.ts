import { HttpAction, IHttpActionParam } from "testflow";
interface Opt{
  groupType?:string;
  len?:number;
  status?:string;
}

function create(opt:Opt):IHttpActionParam{
  return {
    name:'查询订单分组:'+opt.groupType,
    url:'/app/note/listNoteGroup',
    param:{
      status:opt?.status ?? 'normal',
      groupType:opt.groupType,
      warehouseGroupId: "${warehouse.warehouseGroupId}",
      warehouseId: "${warehouse.warehouseId}"
    }
  }
}
export default class extends HttpAction{
  private testOpt:Opt;
  constructor(opt:Opt){
    if(opt == null){
      opt = {};
    }
    super(create(opt))
    this.testOpt = opt;
  }

  protected async checkResult(result: any): Promise<void> {
    let content = result.result.content;
    if(this.testOpt?.len != null){
      this.expectEqual(this.testOpt.len,content.length)
    }
  }
}
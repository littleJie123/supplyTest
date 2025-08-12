import { HttpAction, IHttpActionParam } from "testflow";
interface Opt{
  groupType?:string;
  len?:number;
  status?:string;
  type?:string;
  noteCnt?:number;
}

function create(opt:Opt):IHttpActionParam{
  return {
    name:`查询订单分组:${opt.groupType}[${opt?.status ?? 'normal'}] `,
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
    let content:any[] = result.result.content;
    if(this.testOpt?.len != null){
      this.expectEqual(this.testOpt.len,content.length)
    }
    if(this.testOpt?.noteCnt != null){
      this.expectFind(content,{cnt:this.testOpt?.noteCnt})
    }
  }

  protected buildVariable(result: any) {
    let row = result.result.content[0]
    let opt = this.testOpt;
    return {
      noteGroup:{
        groupType:opt?.groupType,
        type:opt?.type ?? 'Type4Store',
        status:opt?.status ?? 'normal',
        day:row.sysAddTime
      }
    }
  }
}
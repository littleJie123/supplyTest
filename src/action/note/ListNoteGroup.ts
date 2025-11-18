import { HttpAction, IHttpActionParam } from "testflow";
import IOpt, { WarehouseType } from "../../inf/IOpt";
import { after } from "node:test";
import GroupType from "../../inf/GroupType";
interface Opt{
  groupType?:GroupType ;
  len?:number;
  status?:string;
  type?:string;
  noteCnt?:number;
}
function getGroupType(opt:Opt){
  return opt.groupType ?? 'NoteDay'
}

function create(opt:Opt,afterProcess?:IOpt):IHttpActionParam{
  let warehouse = afterProcess?.warehouseType ?? 'warehouse'
  return {
    name:`查询订单分组:${getGroupType(opt)}[${opt?.status ?? 'normal'}] `,
    url:'/app/note/listNoteGroup',
    param:{
      status:opt?.status ?? 'normal',
      groupType:getGroupType(opt),
      warehouseGroupId: `\${${warehouse}.warehouseGroupId}`,
      warehouseId: `\${${warehouse}.warehouseId}`
    }
  }
}
export default class extends HttpAction{
  private testOpt:Opt;
  private warehouseType:WarehouseType
  constructor(opt?:Opt,afterProcess?:IOpt){
    if(opt == null){
      opt = {};
    }
    super(create(opt,afterProcess))
    this.testOpt = opt;
    this.warehouseType = afterProcess?.warehouseType
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

  protected getType():string{
    let opt = this.testOpt;
    let type =  opt?.type ;
    if(type == null){
      if(this.warehouseType == 'supplierWarehouse'){
        type = 'Type4Supplier';
      }else{
        type = 'Type4Store';
      }
      
    }
    return type;
  }

  protected buildVariable(result: any) {
    let row = result.result.content[0]
    let opt = this.testOpt;
    console.log('this.getType()',this.getType());
    return {
      noteGroup:{
        groupType:getGroupType(opt),
        type:this.getType(),
        status:opt?.status ?? 'normal',
        day:row.sysAddTime
      }
    }
  }
}
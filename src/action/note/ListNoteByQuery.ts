import { ArrayUtil, HttpAction } from "testflow";
interface TestOpt{
  query:any,
  checkNotes:any[]
}

function create(opt:TestOpt){
  return {
    url:'/app/note/listNote',
    name:'查询订单',
    param:{
      ... opt.query,
      warehouseGroupId:'${warehouse.warehouseGroupId}'
    }

  }
}
export default class extends HttpAction{
  private testOpt:TestOpt
  constructor(opt:TestOpt){
    super(create(opt))
    this.testOpt = opt;
  }

  protected async checkResult(result: any): Promise<void> {
    if(this.testOpt?.checkNotes){
      this.expectFindByArray(result.result.content,this.testOpt?.checkNotes)
    }
  }

  protected buildVariable(result: any) {
    let content = result.result.content;
    return {
      noteMap:ArrayUtil.toMapByKey(content,'cost','noteId')
    }
  }
}
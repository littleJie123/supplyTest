import { HttpAction, IAfterProcess, IHttpActionParam } from "testflow";
import IOpt from "../inf/IOpt";

interface TestOpt{
  url:string;
  name?:string
  method?:string;
  query?:any

  checkers?:{
    checkArray?:any[];
    len?:number
  }
}
function create(opt:TestOpt,afterProcess:IOpt):IHttpActionParam{
  let query = opt.query ?? {};
  let warehouse = afterProcess?.warehouseType ?? 'warehouse'
  return {
    url:opt.url,
    name:opt.name??'查询接口',
    method:opt.method,
    param:{
      ... query,
      warehouseGroupId:`\${${warehouse}.warehouseGroupId}`
    }
  }
}
export default class extends HttpAction{
  private testOpt:TestOpt
  constructor(opt:TestOpt,afterProcess?:IOpt){
    super(create(opt,afterProcess),afterProcess);
    this.testOpt = opt;
  }



  protected async checkResult(result: any): Promise<void> {
    await super.checkResult(result)
    let opt = this.testOpt;
    let content = result.result.content
    if(opt?.checkers?.checkArray){
      this.expectFindByArray(content,opt?.checkers?.checkArray)
    }

    if(opt?.checkers?.len){
      this.expectEqual(content.length,opt?.checkers?.len)
    }
  }
}
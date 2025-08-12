import { HttpAction, IHttpActionParam } from "testflow";

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
function create(opt:TestOpt):IHttpActionParam{
  let query = opt.query ?? {};
  return {
    url:opt.url,
    name:opt.name??'查询接口',
    method:opt.method,
    param:{
      ... query,
      warehouseGroupId:'${warehouse.warehouseGroupId}'
    }
  }
}
export default class extends HttpAction{
  private testOpt:TestOpt
  constructor(opt:TestOpt){
    super(create(opt));
    this.testOpt = opt;
  }

  protected buildVariable(result: any) {
    
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
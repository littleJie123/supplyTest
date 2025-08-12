import { url } from "inspector";
import { HttpAction, IHttpActionParam } from "testflow";
interface TestOpt{
  name?:string;
  type?:string;
  variableType?:string;
}

function getName(opt:TestOpt){
  return opt?.name ?? "新餐厅"
}
function create(opt:TestOpt):IHttpActionParam{
    return {
      url:'/app/warehouse/addwarehouse',
      name:`注册${getName(opt)}`,
      param:{
        "name":getName(opt),
        warehouseGroupId:0,
        type:opt?.type ?? 'store'
      },
      method:'post',
     
    }
  }

export default class extends HttpAction{
  constructor(opt?:TestOpt){
    super(create(opt))
  }

  protected parseHttpParam() {
    let ret = super.parseHttpParam();
    return ret;
  }

  getHeader(){
    return {
      token:'${token}'
    }
  }

  protected buildVariable(result: any) {

    return {
      warehouse:result.result
    };
  }

}
import { url } from "inspector";
import { HttpAction } from "testflow";

export default class extends HttpAction{
  getDefHttpParam(){
    return {
      url:'/app/warehouse/addwarehouse',
      name:'注册仓库',
      param:{"name":"新餐厅",warehouseGroupId:0},
      method:'post',
     
    }
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
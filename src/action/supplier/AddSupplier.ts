import { HttpAction,IHttpActionParam } from "testflow"; 

export default class AddSupplier extends HttpAction {
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name:'增加卖家',
      method:'POST',
      url:'/app/supplier/addsupplier',
      param:{
        "name":"我的供应商",
        "warehouseGroupId":"${variable.warehouse.warehouseGroupId}"
      }
    }
  }

  
  
  protected buildVariable(result: any) {
    return {
      supplier:result.result
    }  
  }
}
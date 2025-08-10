import { HttpAction,IHttpActionParam } from "testflow"; 

export default class AddSupplier extends HttpAction {
  private name:string;
  constructor(name){
    
    super({
      name:'增加卖家:'+name,
      method:'POST',
      url:'/app/supplier/addsupplier',
      param:{
        "name":name,
        "warehouseGroupId":"${warehouse.warehouseGroupId}"
      }
    })
    this.name = name;
  }
  
  
  
  protected buildVariable(result: any) {
    return {
      supplier:result.result
    }  
  }
}
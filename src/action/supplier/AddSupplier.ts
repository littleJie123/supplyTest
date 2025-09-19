import { HttpAction,IHttpActionParam } from "testflow"; 

interface Opt{
  type?:string
}
export default class AddSupplier extends HttpAction {
  private name:string;
  constructor(name,opt?:Opt){
    
    super({
      name:'增加卖家:'+name,
      method:'POST',
      url:'/app/supplier/addsupplier',
      param:{
        "name":name,
        "warehouseGroupId":"${warehouse.warehouseGroupId}",
        type:opt?.type ?? 'supplier'
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
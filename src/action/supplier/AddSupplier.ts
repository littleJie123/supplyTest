import { HttpAction,IHttpActionParam } from "testflow"; 
import { WarehouseType } from "../../inf/IOpt";

interface Opt{
  type?:string;
  warehouseType?:WarehouseType;
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
        "warehouseGroupId":`\${${opt?.warehouseType ?? 'warehouse'}.warehouseGroupId}`,
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
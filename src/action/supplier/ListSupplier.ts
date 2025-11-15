import { HttpAction,IHttpActionParam } from "testflow"; 
import { WarehouseType } from "../../inf/IOpt";
interface Opt{
  warehouseType:WarehouseType
}
export default class AddSupplier extends HttpAction {

  constructor(opt?:Opt){
    
    super({
      name:'查询供应商',
      method:'POST',
      url:'/app/supplier/listsupplier',
      param:{
        "warehouseGroupId":`\${${opt?.warehouseType ?? 'warehouse'}.warehouseGroupId}`
      }
    })
  }

 
  
  
  protected buildVariable(result: any) {
    let content:any[] = result.result.content
    let map = {}
    for(let row of content){
      map[row.name] =row.supplierId
    }
    return {
      supplierMap:map
    }  
  }
}
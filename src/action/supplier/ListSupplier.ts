import { HttpAction,IHttpActionParam } from "testflow"; 

export default class AddSupplier extends HttpAction {
;
  constructor(){
    
    super({
      name:'查询供应商',
      method:'POST',
      url:'/app/supplier/listsupplier',
      param:{
        "warehouseGroupId":"${warehouse.warehouseGroupId}"
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
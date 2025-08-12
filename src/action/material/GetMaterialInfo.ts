import { HttpAction, IHttpActionParam } from "testflow";



export default class extends HttpAction {
  private checkObj:any
  private supplierName:string
  private len:number
  needInScreen(): boolean {
    return false;
  }
  constructor(checkObj:any,supplierName?:string,len?:number){
            
    super({
      name:'读取物料信息',
      url:'/app/material/getMaterialInfo',
      param:{
        materialId:"${lastMaterialId}",
        warehouseId:"${warehouse.warehouseId}",
        warehouseGroupId:"${warehouse.warehouseGroupId}"
      }
    })
    this.supplierName = supplierName ?? '供应商1'
    this.checkObj = checkObj;
    this.len = len;
  }

  protected async checkResult(result: any): Promise<void> {
    if(this.checkObj != null){
      let variable = this.getVariable()
      let supplier = result.result.suppliers.find(row=>row.isDef==1)
      this.expectEqualObj(supplier,
        this.checkObj)
      if(this.supplierName){
        this.expectEqual(supplier.supplierId,variable.supplierMap[this.supplierName])
      }
      if(this.len){
        this.expectEqual(result.result.suppliers.length,this.len);
      }
    }
  }


   

  

}
import { HttpAction, IHttpActionParam } from "testflow";
interface Opt{
  buyUnit?:any[]
  suppliers?:any[]
}

function createParam(name:string,opt?:Opt): IHttpActionParam {

  return {
    method:'POST',
    name:'更改物料:'+name,
    url:'/app/material/updateMaterial',
    param: {
      name,
      "materialId":"${lastMaterialId}",
      "buyUnit": opt?.buyUnit ?? [
        {  "name": "g", isSupplier:true },{  "name": "瓶", fee:500 }
      ],
      "suppliers": opt?.suppliers ?? [
        {
          "isDef": true,
          "supplierId": "${supplierMap.供应商1}",
          
          "price": 0.2
        }],
      "img": [],
      "warehouseId": "${warehouse.warehouseId}",
      "warehouseGroupId": "${warehouse.warehouseGroupId}"
    }
  }

}

export default class extends HttpAction {
  constructor(name:string,opt?:Opt){
    super(createParam(name,opt))
  }
   

  

}
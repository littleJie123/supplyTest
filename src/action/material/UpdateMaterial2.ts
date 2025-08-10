import { HttpAction, IHttpActionParam } from "testflow";

function createParam(name:string,onlyOne:boolean): IHttpActionParam {

  let ret = {
    method:'POST',
    name:'更改物料:'+name,
    url:'/app/material/updateMaterial',
    param: {
      name,
      "materialId":"${lastMaterialId}",
      "buyUnit": [
       {  "name": "瓶" }, {  "name": "箱", isSupplier:true,fee:10 }
      ],
      "suppliers": [
        {
          
          "supplierId": "${supplierMap.供应商1}",
          
          "price": 150
        },
        {
          isDef:true,
          "supplierId": "${supplierMap.供应商2}",
          
          "price": 200
        }
      ],
      "img": [],
      "warehouseId": "${warehouse.warehouseId}",
      "warehouseGroupId": "${warehouse.warehouseGroupId}"
    }
  }
  if(onlyOne){
    ret.param.suppliers = [ret.param.suppliers[0]]
  }
  return ret;
}

export default class extends HttpAction {
  constructor(name:string,onlyOne?:boolean){
    super(createParam(name,onlyOne))
  }
   

  

}
import { HttpAction, IHttpActionParam } from "testflow";
import { WarehouseType } from "../../inf/IOpt";
interface Opt{
  buyUnit?:any[]
  suppliers?:any[]
  type?:WarehouseType
}
function createParam(name: string,opt?:Opt): IHttpActionParam {

  return {
    method:'POST',
    name:'增加商品：'+name,
    url:'/app/material/SaveMaterial',
    param: {
      "buyUnit": opt?.buyUnit ?? [
        { "isSupplier": true, "name": "瓶", "fee": 1 }
      ],
      "suppliers": opt?.suppliers ?? [
        {
          "isDef": true,
          "supplierId": "${supplierMap.供应商1}",
          
          "price": 21
        }],
      "img": [],
      "name": name,
      ... getWarehouse(opt)
    }
  }

}
function getWarehouse(opt?:Opt){
  let type = opt?.type ?? 'warehouse';
  if(type === 'warehouse'){
    return {
      "warehouseId": "${warehouse.warehouseId}",
      "warehouseGroupId": "${warehouse.warehouseGroupId}"
    }
  }else if(type === 'supplierWarehouse'){
    return {
      "warehouseId": "${supplierWarehouse.warehouseId}",
      "warehouseGroupId": "${supplierWarehouse.warehouseGroupId}"
    }
  }
}

export default class extends HttpAction {

  constructor(name,opt?:Opt) {
    super(createParam(name,opt))

  }

  protected buildVariable(result: any) {
    return {
      lastMaterialId:result.result.materialId
    }
  }

}
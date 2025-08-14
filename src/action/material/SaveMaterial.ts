import { HttpAction, IHttpActionParam } from "testflow";
import IOpt from "../../inf/IOpt";
import WarehouseUtil from "../../util/WarehouseUtil";
interface Opt{
  buyUnit?:any[]
  suppliers?:any[]
  name:string
}
function createParam(opt?:Opt,afterProcess?:IOpt): IHttpActionParam {

  return {
    method:'POST',
    name:'增加商品：'+opt.name,
    url:'/app/material/SaveMaterial',
    param: {
      "buyUnit": opt?.buyUnit ?? [
        { "isSupplier": true, "name": "箱", "fee": 1 }
      ],
      "suppliers": opt?.suppliers ,
      "img": [],
      "name": opt.name,
      ... WarehouseUtil.get(afterProcess)
    }
  }

}

export default class extends HttpAction {

  constructor(opt:Opt,afterProcess:IOpt) {
    super(createParam(opt,afterProcess))

  }

  

}
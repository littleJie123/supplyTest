import { HttpAction, IHttpActionParam } from "testflow";
interface Opt{
  name:string;
  stock:any;
}

function createParam(opt:Opt): IHttpActionParam {
  return {
    name: '设置订货数量:'+opt?.name,
    url: '/app/noteItem/addPurcharse',
    method:'post',
    param: {
      "stock": opt?.stock,
      "materialId": "${materialMap."+opt?.name+".materialId}",
      warehouseId:"${warehouse.warehouseId}",
      warehouseGroupId:"${warehouse.warehouseGroupId}",
    }
  }
}
export default class extends HttpAction {
  constructor(opt:Opt) {
    
    super(createParam(opt))
  }
}
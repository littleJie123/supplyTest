import { HttpAction, IHttpActionParam } from "testflow";

export default class extends HttpAction{
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name:'盘点后查询物料',
      url:'/app/material/listMaterialByCategory',
      method:'POST',
      param:{
        "materialId":[3810],
        "warehouseId":138,
        "warehouseGroupId":153
      }
    }
  }

  getParamMeta() {
    return {
      warehouseId:'warehouse.warehouseId',
      warehouseGroupId:'warehouse.warehouseGroupId',
    }
  }
}
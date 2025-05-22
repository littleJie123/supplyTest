import { HttpAction, IHttpActionParam } from "fasttest";

export default class extends HttpAction{
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name:'创建订单',
      url:'/app/note/createNote',
      method:'POST',
      param:{
        "items":[
          {
            "materialId":"${variable.materialMap.酱油.materialId}",
            "supplierId":"${variable.supplier.supplierId}",
            "cnt":15000,
            "buyUnitFee":1,
            "stockUnitsId":18,
            "price":21,
            "stockBuyUnitFee":-500
          },
          {
            "materialId":"${variable.materialMap.米醋.materialId}",
            "supplierId":"${variable.supplier.supplierId}",
            "cnt":10000,
            "buyUnitFee":1,
            "stockUnitsId":18,
            "price":21,
            "stockBuyUnitFee":-500
          },
          {
            "materialId":"${variable.materialMap.白酒.materialId}",
            "supplierId":"${variable.supplier.supplierId}",
            "cnt":5000,
            "buyUnitFee":1,
            "stockUnitsId":18,
            "price":21,
            "stockBuyUnitFee":-500
          }
        ],
        "warehouseId":"${variable.warehouse.warehouseId}",
        "warehouseGroupId":"${variable.warehouse.warehouseGroupId}"
      }
    }
  }
}
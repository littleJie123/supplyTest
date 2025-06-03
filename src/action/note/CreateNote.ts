import { HttpAction, IHttpActionParam } from "testflow";

export default class extends HttpAction{
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name:'创建订单',
      url:'/app/note/createNote',
      method:'POST',
      param:{
        "items":[
          {
            "materialId":"${materialMap.酱油.materialId}",
            "supplierId":"${supplier.supplierId}",
            "cnt":15000,
            "buyUnitFee":1,
            "stockUnitsId":18,
            "price":21,
            "stockBuyUnitFee":-500
          },
          {
            "materialId":"${materialMap.米醋.materialId}",
            "supplierId":"${supplier.supplierId}",
            "cnt":10000,
            "buyUnitFee":1,
            "stockUnitsId":18,
            "price":21,
            "stockBuyUnitFee":-500
          },
          {
            "materialId":"${materialMap.白酒.materialId}",
            "supplierId":"${supplier.supplierId}",
            "cnt":5000,
            "buyUnitFee":1,
            "stockUnitsId":18,
            "price":21,
            "stockBuyUnitFee":-500
          }
        ],
        "warehouseId":"${warehouse.warehouseId}",
        "warehouseGroupId":"${warehouse.warehouseGroupId}"
      }
    }
  }
}
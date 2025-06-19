import { HttpAction, IHttpActionParam } from "testflow";

export default class extends HttpAction {
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name: '创建水果订单【多餐厅供货用】',
      url: '/app/note/createNote',
      method: 'POST',
      param: {
        "items": [
          {
            "materialId": 3919,
            "supplierId": 197,
            "cnt": 20,
            "buyUnitFee": 1,
            "stockUnitsId": 1,
            "price": 32,
            "stockBuyUnitFee": 1
          },
          {
            "materialId": 3918,
            "supplierId": 197,
            "cnt": 10,
            "buyUnitFee": 1,
            "stockUnitsId": 1,
            "price": 12,
            "stockBuyUnitFee": 1
          }
        ],
        "warehouseId": 124,
        "warehouseGroupId": 139
      }
    }

    
  }
  getParamMeta() {
    return {
      warehouseId:'warehouse.warehouseId',
      warehouseGroupId:'warehouse.warehouseGroupId',
      supplierId:'supplier.supplierId',
      materialId:[
        'materialMap.车厘子.materialId',
        'materialMap.小番茄.materialId'
      ]
    }
  }
}
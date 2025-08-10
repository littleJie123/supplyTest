import { HttpAction } from "testflow";

export default class extends HttpAction {
  constructor() {
    super({
      name:'提交订单',
      url:'/app/note/createNote',
      method:'post',
      param: {
        "items": [
          {
            "materialId": '${materialMap.牛肉.materialId}',
            "supplierId": '${supplierMap.供应商2}',
            "cnt": 50,
            "buyUnitFee": 1,
            "stockUnitsId": 18,
            "price": 10,
            "stockBuyUnitFee": 1
          },
          {
            "materialId": '${materialMap.猪肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 400,
            "buyUnitFee": 1,
            "stockUnitsId": 5,
            "price": 21,
            "stockBuyUnitFee": -10
          },
          {
            "materialId": '${materialMap.羊肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 30,
            "buyUnitFee": 500,
            "stockUnitsId": 29,
            "price": 0.2,
            "stockBuyUnitFee": 500
          }
        ],
        "warehouseId": '${warehouse.warehouseId}',
        "warehouseGroupId": '${warehouse.warehouseGroupId}'
      }
    })
  }


  protected buildVariable(result: any) {
    let content:any[] = result.result;
    let supplier1 = content.find(row=>row.supplierName=='供应商1');
    let supplier2 = content.find(row=>row.supplierName=='供应商2');
    return {
      noteMap:{
        '供应商1':supplier1.noteId,
        '供应商2':supplier2.noteId
      }
    }
  }

  protected async checkResult(result: any): Promise<void> {
    let content:any[] = result.result;
    let supplier1 = content.find(row=>row.supplierName=='供应商1');
    let supplier2 = content.find(row=>row.supplierName=='供应商2');
    this.expectEqual(supplier1.materialCnt,2);
    this.expectEqual(supplier1.cost,846)

    this.expectEqual(supplier2.materialCnt,1);
    this.expectEqual(supplier2.cost,500)
  }
}
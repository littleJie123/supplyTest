import { HttpAction, IHttpActionParam } from "testflow";

export default class extends HttpAction{
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name:'查询订单商品列表',
      url:'/app/note/listNote',
      method:'POST',
      param:{
        supplierId: "${supplier.supplierId}", 
        warehouseId: "${warehouse.warehouseId}", 
        status: "normal", 
        warehouseGroupId: "${warehouse.warehouseGroupId}",
      }
    }
  }

  protected buildVariable(result: any) {
    
    return {
      note: result.result.content[0],
    }
  }
}
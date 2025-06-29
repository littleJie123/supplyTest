import { HttpAction, IHttpActionParam } from "testflow";

export default class extends HttpAction {
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name: '批量处理订单',
      url: '/app/note/batchProcessNote',
      method: 'POST',
      param: { 
        "query": { "day": "2025-06-23", "status": "normal" }, 
        "warehouseId": 193, 
        "action": "instock", 
        "warehouseGroupId": 1244 
      }
    }


  }

}
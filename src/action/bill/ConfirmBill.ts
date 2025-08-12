import { HttpAction } from "testflow";

export default class extends HttpAction {
  constructor(){
    super({
      name:'确认结算单',
      url:'/app/bill/confirmBill',
      param:{
        billId: "${billIds}",
        warehouseGroupId: "${warehouse.warehouseGroupId}"
      }
    })
  }
}
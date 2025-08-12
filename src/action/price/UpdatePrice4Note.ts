import { HttpAction } from "testflow";

export default class extends HttpAction{
  constructor(){
    super({
      name:'更改订单价格',
      url:'/app/note/updatePrice',
      param:{
        noteItems:"${needUpdatePriceItem}",
        warehouseGroupId:"${warehouse.warehouseGroupId}"
      }
    })
  }
}
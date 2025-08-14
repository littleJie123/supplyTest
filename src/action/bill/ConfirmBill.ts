import { HttpAction } from "testflow";
import IOpt from "../../inf/IOpt";
import WarehouseUtil from "../../util/WarehouseUtil";

export default class extends HttpAction {
  constructor(afterProcess?:IOpt){
    super({
      name:'确认结算单',
      url:'/app/bill/confirmBill',
      param:{
        billId: "${billIds}",
        warehouseGroupId: WarehouseUtil.getGroupId(afterProcess)
      }
    })
  }
}
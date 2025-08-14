import { HttpAction, IHttpActionParam } from "testflow";
import IOpt from "../../inf/IOpt";
import WarehouseUtil from "../../util/WarehouseUtil";

interface Opt {
  action?: string
}

function create(opt: Opt,afterProcess?:IOpt): IHttpActionParam {
  return {
    name: '批量处理：' + opt.action,
    url: '/app/note/batchProcessNote',
    method: 'POST',
    
    param: {
      "query":  { "day": "${noteGroup.day}", "status": "${noteGroup.status}" },
      
      "action": opt.action ?? "instock",
      "groupType": "${noteGroup.groupType}",
      "type": "${noteGroup.type}",
      ... WarehouseUtil.get(afterProcess)
    }
  }


}

export default class extends HttpAction {

  constructor(opt: Opt,afterProcess?:IOpt) {
    super(create(opt,afterProcess),afterProcess)
  }

  protected buildVariable(result: any) {
    let array:any[] = result.result;
    if(array == null || !(array instanceof Array)){
      return null;
    }
    array = array.filter(row=>row.billId != null && row.billNotes != null)
    if(array.length == 0){
      return null;
    }
    return {
      billIds:array.map(row=>row.billId)
    } 
  }
}
import { HttpAction, IAfterProcess, IHttpActionParam } from "testflow";
import IOpt from "../inf/IOpt";

export default class extends HttpAction {
  constructor(param:IHttpActionParam,afterProcess?:IOpt){
    if(param.param){
      if(param.param.warehouseGroupId == null){
        let warehouse = afterProcess?.warehouseType ?? 'warehouse';
        param.param.warehouseGroupId = `\${${warehouse}.warehouseGroupId}`
      }
    }
    super(param,afterProcess)
  }
}
import { HttpAction, IHttpActionParam } from "testflow";

interface Opt {
  action?: string;
  index:number;

}

function create(opt: Opt): IHttpActionParam {
  return {
    name: `处理订单：${opt.action ?? "instock"}[${opt.index}]`,
    url: '/app/note/batchProcessNote',
    method: 'POST',
    
    param: {
       
      "warehouseId": "${warehouse.warehouseId}",
      "action": opt.action ?? "instock",
      "noteIds":`\${notes.${opt.index}.noteId}`,
      "type": `\${notes.${opt.index}.type}`,
      "warehouseGroupId": "${warehouse.warehouseGroupId}"
    }
  }


}



export default class extends HttpAction {

  constructor(opt: Opt) {
    super(create(opt))
  }

  protected parseHttpParam() {
    let retObj = super.parseHttpParam();
    retObj.noteIds = [retObj.noteIds]
    return retObj;
  }

  
}
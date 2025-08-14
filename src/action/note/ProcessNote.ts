import { after } from "node:test";
import { HttpAction, IAfterProcess } from "testflow";
import NoteItemUtil from "../../util/NoteItemUtil";
interface TestOpt {
  action?:string;
  noteId:string;
  noteItems:string
  buildItem?(item):any;
}

function getAction(opt: TestOpt){
  return opt?.action ?? 'instock'
}

function create(opt?: TestOpt) {
  return {
    name:`订单操作:${getAction(opt)}`,
    url: '/app/note/processNote',
    param: {
      "noteId":opt.noteId ,
      "noteItems": opt.noteItems,
      "action": getAction(opt),
      "warehouseId": "${warehouse.warehouseId}",
      "warehouseGroupId":"${warehouse.warehouseGroupId}"
    }
  }
}

export default class extends HttpAction {
  protected testOpt:TestOpt;
  constructor(opt:TestOpt,afterProcess?:IAfterProcess) {
    super(create(opt),afterProcess)
    this.testOpt = opt;
  }

  protected parseHttpParam() {
    let param = super.parseHttpParam();
    let noteItems = NoteItemUtil.change( param.noteItems);
    let opt = this.testOpt;
    if(opt?.buildItem){
      noteItems = noteItems.map(item=>opt.buildItem(item))
    }
    param.noteItems = noteItems;
    return param;
  }

}
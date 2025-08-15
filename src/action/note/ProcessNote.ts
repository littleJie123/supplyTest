import { after } from "node:test";
import { HttpAction, IAfterProcess } from "testflow";
import NoteItemUtil from "../../util/NoteItemUtil";
import IOpt from "../../inf/IOpt";
import WarehouseUtil from "../../util/WarehouseUtil";
interface TestOpt {
  action?:string;
  noteId:string;
  noteItems:string
  buildItem?(item):any;
}

function getAction(opt: TestOpt){
  return opt?.action ?? 'instock'
}

function create(opt?: TestOpt,afterProcess?:IOpt) {
  return {
    name:`订单操作:${getAction(opt)}`,
    url: '/app/note/processNote',
    param: {
      "noteId":opt.noteId ,
      "noteItems": opt.noteItems,
      "action": getAction(opt),
      ... WarehouseUtil.get(afterProcess)
    }
  }
}

export default class extends HttpAction {
  protected testOpt:TestOpt;
  constructor(opt:TestOpt,afterProcess?:IOpt) {
    super(create(opt,afterProcess),afterProcess)
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
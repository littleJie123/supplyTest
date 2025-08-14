import { HttpAction } from "testflow";

interface TestOpt{
  noteId:string
}
export default class extends HttpAction {
  constructor(opt:TestOpt) {
    super({
      name: '拆单',
      url:'/app/note/splitNote',
      param:{
        "noteId": opt.noteId,
        "noteItems": '${noteItemId}',
        warehouseGroupId:'${warehouse.warehouseGroupId}'
      }
    })
  }

  protected parseHttpParam() {
    let param = super.parseHttpParam();
    param.noteItems = [{noteItemId:param.noteItems}]
    return param;
  }
}
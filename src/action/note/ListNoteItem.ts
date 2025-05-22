import { HttpAction, IHttpActionParam, TestCase } from "testflow";

export default class extends HttpAction{
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name:'查询订单明细',
      url:'/app/noteItem/listNoteItem',
      method:'GET',
      param:{
        noteId: "${variable.note.noteId}",
        warehouseGroupId: "${variable.warehouse.warehouseGroupId}",
      }
    }
  }

  protected buildVariable(result: any) {

    return {
      noteItem: result.result.content,
    }
  }
}
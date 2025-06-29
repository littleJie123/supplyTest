import { HttpAction, IHttpActionParam } from "testflow";

export default class extends HttpAction{
  protected getDefHttpParam(): IHttpActionParam {
    return {
      name:'订单根据时间',
      url:'/app/note/listNoteDay',
      method:'POST',
      param:{
        status: "normal", 
        warehouseId: 193, 
        warehouseGroupId: 1244,
        sysAddTime:'06-20'

      }
    }
  }

  protected buildVariable(result: any) {
    
    return {
      note: result.result.content[0],
    }
  }
}
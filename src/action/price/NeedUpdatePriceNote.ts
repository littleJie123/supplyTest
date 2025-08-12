import { HttpAction } from "testflow";
import NoteItemUtil from "../../util/NoteItemUtil";
interface TestOpt{

}
export default class extends HttpAction{
  private testOpt:TestOpt;
  private materialId:number;
  private noteItemId:number;
  private noteItems:any[]
  constructor(opt:TestOpt){
    super({
      name:'查询改价订单',
      url:'/app/note/needUpdatePriceNote',
      param:{
        noteId:'${noteMap.供应商1}',
        warehouseGroupId:'${warehouse.warehouseGroupId}'
      }
    });
    this.testOpt =opt;
  }

  protected parseHttpParam() {
    let noteItems:any[] = this.getVariable().noteItem;
    noteItems =noteItems.filter(row=>row.name == '猪肉')
    this.materialId = noteItems[0].materialId
    this.noteItemId = noteItems[0].noteItemId
    noteItems = noteItems.map(row=>{
      return {
        ... NoteItemUtil.changeOne(row),
        price:20
      }
    })
    this.noteItems = noteItems
    let ret = super.parseHttpParam()
    ret.noteItems = noteItems;
    return ret;
  }

  protected buildVariable(result: any) {
    return {
      needUpdatePriceItem:[
        ... result.result.content[0].noteItems.map(row=>({
          ... row,
          price:20
        })),
        ... this.noteItems
      ],
      noteItems:this.noteItems
    }
  }


  

  protected async checkResult(result: any): Promise<void> {
    let noteItems = result.result.content[0].noteItems;
    this.expectFind(noteItems,{
      materialId:this.materialId
    })
    this.expectNotFind(noteItems,{noteItemId:this.noteItemId})
  }


}
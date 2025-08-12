import { HttpAction } from "testflow";
import NoteItemUtil from "../../util/NoteItemUtil";
interface TestOpt{

}
export default class extends HttpAction{
  private testOpt:TestOpt;
  constructor(opt:TestOpt){
    super({
      name:'查询改价合同',
      url:'/app/supplierMaterial/needUpdateMaterials',
      param:{
        noteItems:'${noteItems}',
        noteId:'${noteMap.供应商1}',
        warehouseGroupId:'${warehouse.warehouseGroupId}'
      }
    });
    this.testOpt =opt;
  }

  
  protected async checkResult(result: any): Promise<void> {
    let content = result.result.content;
    let materialId = this.getVariable().noteItems[0].materialId
    this.expectFind(content,{
      materialId:materialId
    })
  }

  protected buildVariable(result: any) {
    return {
      supplierMaterial:result.result.content
    }
  }
}
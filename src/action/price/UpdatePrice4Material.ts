import { HttpAction } from "testflow";

export default class extends HttpAction{
  constructor(){
    super({
      name:'更改物料价格',
      url:'/app/supplierMaterial/updatePrice',
      param:{
        items:"${supplierMaterial}",
        warehouseGroupId:"${warehouse.warehouseGroupId}"
      }
    })
  }

  protected parseHttpParam() {
    let ret = super.parseHttpParam();
    ret.items = ret.items.map(row=>({
      ... row,
      price:20
    }))
    return ret;
  }

  protected buildVariable(result: any) {
    
    let noteItems:any[] = this.getVariable().noteItem;
    let row = noteItems.find(row=>row.name=='猪肉')
    return {
      lastMaterialId:row.materialId
    }
  }
}
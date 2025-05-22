import { HttpAction } from "testflow";

export default class extends HttpAction{
  constructor(){
    super({
      name:'获取商品',
      url:'/app/material/listMaterialByCategory',
      method:'POST',
      param:{
        warehouseGroupId:'${variable.warehouse.warehouseGroupId}',
        warehouseId:'${variable.warehouse.warehouseId}'
      }
    })
  }

  protected buildVariable(result: any) {
    let content = result.result.content;
    let materialMap:any = {};
    for(let row of content){
      materialMap[row.name] = row;
    }
    return {
      materialMap
    }
  }
}
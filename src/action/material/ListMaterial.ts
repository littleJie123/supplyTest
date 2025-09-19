import { HttpAction } from "testflow";
import { WarehouseType } from "../../inf/IOpt";

interface Opt {
  hasPurcharse?:number
  type?:WarehouseType
}
/**
 * 查询出物料，并且把物料放到materialMap中
 */
export default class extends HttpAction{
  private testOpt:Opt

  constructor(opt?:Opt){
    let warehouseType = opt?.type ?? 'warehouse'
    super({
      name:'获取商品',
      url:'/app/material/listMaterialByCategory',
      method:'POST',
      param:{
        warehouseGroupId:`\${${warehouseType}.warehouseGroupId}`,
        warehouseId:`\${${warehouseType}.warehouseId}`
      }
    })
    this.testOpt = opt;
  }

  protected buildVariable(result: any) {
    let content = result.result.content;
    let materialMap:any = {};
    for(let row of content){
      materialMap[row.name] = {
        materialId:row.materialId
      };
    }
    return {
      materialMap
    }
  }

  protected async checkResult(result: any): Promise<void> {
    let opt = this.testOpt;
    if(opt){
      let content:any[] = result.result.content;
      if(opt.hasPurcharse){
        let purcharses = content.filter(row=>row.purcharse != null);
        this.expectEqual(purcharses.length,opt.hasPurcharse)
      }
    }
  }
}
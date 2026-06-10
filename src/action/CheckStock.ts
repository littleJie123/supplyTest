import { CheckUtil } from "testflow";
import Action from "./Action";
interface Stock {
  cnt:number;
  materialId:string;
  buyUnitFee?:number
}
interface Opt{
  array:Stock[]
}

export default class extends Action{
  constructor(opt:Opt){
    super({
      name:'验证库存',
      url:'/free/stock',
      param:{
        array:opt.array,
        action:'checkStock',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId:'${warehouse.warehouseGroupId}'
        }
      }
    },{
      check:(result)=>{
        
        if(result.error != null){
          this.getTestLogger().log(JSON.stringify(result.error));
        }
        CheckUtil.expectEqual(result.error == null ,true);
      }
    })
  }
}
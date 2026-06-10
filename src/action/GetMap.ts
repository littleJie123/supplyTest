import { ArrayUtil } from "testflow";
import Action from "./Action";
interface Opt {
  tables?:string[];
}

function buildParam(opt:Opt){
  let tables:string[] = opt?.tables ?? ['product','material']
  return tables.map(table=>({
    table,
    query:{
      warehouseGroupId:'${warehouse.warehouseGroupId}'
    }
  }));
}

export default class extends Action{
  constructor(opt?:Opt){
    super({
      name:'GetMap',
      url:'/free/query',
      param:{
        array:buildParam(opt)
      }
    },{
      buildVariable(result){
        result = result.result;
        let ret:any = {};
        for(let e in result){
          ret[e] = ArrayUtil.toMapByKey(result[e],'name',e+'Id')
        }
        return ret;
      }
    })
  }
}
import { CheckUtil } from "testflow";
import Action from "./Action";

interface Opt {
  table: string;
  query?: any; 
  notWarhouseId?: boolean;
  check?(array:any[]);
}
function buildQuery(opt: Opt) {
  let ret: any
  if (opt?.query != null) {
    ret = opt.query
    ret.warehouseGroupId = '${warehouse.warehouseGroupId}'
  } else {
    ret = {
      warehouseGroupId: '${warehouse.warehouseGroupId}'
    }
    if (!opt?.notWarhouseId) {
      ret.warehouseId = '${warehouse.warehouseId}';
    }
  }
  if (ret.isDel == null) {
    ret.isDel = 0;
  }
  return ret;
}
export default class extends Action {
  constructor(opts: Opt[]) {
    super(
      {
        name: `验证数组:${opts.map(row => row.table).join(',')}`,
        url: '/free/query',
        param: {
          array: opts.map(opt => ({
            table: opt.table,
            query: buildQuery(opt) 
            
          }))
        }
      },
      {
        check(result) {
          result = result.result;
          for (let e in result) {
            let opt = opts.find(row => row.table == e);
            if (opt) {
              if (opt.check != null) {
                opt.check(result[e])
              }
            }
          }
        }
      }
    )
  }
}
import { CheckUtil } from "testflow";
import Action from "./Action";

interface Opt {
  table: string;
  query?: any;
  /** 查询不加 warehouseId（表无该字段时用） */
  notWarhouseId?: boolean;
  /** 查询不加 warehouseGroupId（如 buyUnit、units 无该字段） */
  notWarehouseGroupId?: boolean;
  check?(array: any[]);
}
function buildQuery(opt: Opt) {
  let ret: any
  if (opt?.query != null) {
    ret = { ...opt.query }
  } else {
    ret = {}
    if (!opt?.notWarhouseId) {
      ret.warehouseId = '${warehouse.warehouseId}';
    }
  }
  if (!opt?.notWarehouseGroupId) {
    ret.warehouseGroupId = '${warehouse.warehouseGroupId}'
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
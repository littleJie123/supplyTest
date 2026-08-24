import { HttpAction } from 'testflow';

interface Opt {
  name?: string;
  array: any[];
}

/**
 * 批量记录订货数量，可带价格、供应商（均可为空）。
 */
export default class extends HttpAction {
  constructor(opt: Opt) {
    super({
      name: opt.name ?? '批量订货',
      url: '/app/noteItem/addPurcharseByMaterials',
      method: 'post',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        array: opt.array
      }
    })
  }
}

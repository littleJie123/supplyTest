import { HttpAction, IHttpActionParam } from "testflow";
interface Opt {
  name: string;
  stock: any;
}

function createParam(opt: Opt): IHttpActionParam {
  let stock = opt.stock;
  stock.materialId = "${materialMap." + opt?.name + ".materialId}"
  return {
    name: '设置订货数量:' + opt?.name,
    url: '/app/noteItem/addPurcharse',
    method: 'post',
    param: {
      "stock": opt?.stock,

      warehouseId: "${warehouse.warehouseId}",
      warehouseGroupId: "${warehouse.warehouseGroupId}",
    }
  }
}
export default class extends HttpAction {
  constructor(opt: Opt) {

    super(createParam(opt))
  }
}
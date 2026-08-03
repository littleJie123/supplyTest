import Action from "../Action";

/**
 * 按营业日删除该仓销售记录（走非生产接口 /free/config/delSalesRecord）。
 */
export default class DelSalesByDay extends Action {
  constructor(salesDate: string) {
    super({
      name: `删除${salesDate}销售记录`,
      url: '/free/config/delSalesRecord',
      param: {
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        salesDate
      }
    });
  }
}

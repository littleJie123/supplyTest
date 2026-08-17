import { HttpAction } from "testflow";

interface ItemChange {
  /** 物料名称，与 noteItems 中 name 匹配 */
  name: string;
  price?: number;
  stockBuyUnitFee?: number;
  /** 不传则不改入库数量；传入时按采购单位(stockUnitsId)数量，服务端 parseInstockCnt 换算 */
  instockCnt?: number;
}

interface Opt {
  name?: string;
  noteItemsVar?: string;
  changes: ItemChange[];
  highlight?:boolean;
}

export default class extends HttpAction {
  private testOpt: Opt;

  constructor(opt: Opt) {
    super({
      name: opt.name ?? '更新入库价格/数量',
      url: '/app/note/updatePrice',
      param: {},
      highlight:opt?.highlight
    });
    this.testOpt = opt;
  }

  protected parseHttpParam() {
    const variable = this.getVariable();
    const noteItemsVar = this.testOpt.noteItemsVar ?? 'noteItems';
    const source: any[] = variable[noteItemsVar] ?? [];
    const changeMap = new Map(this.testOpt.changes.map(row => [row.name, row]));
    const noteItems = source
      .filter(row => changeMap.has(row.name))
      .map(row => {
        const change = changeMap.get(row.name);
        const item: any = {
          noteItemId: row.noteItemId,
          materialId: row.materialId
        };
        if (change.price != null) {
          item.price = change.price;
          item.stockBuyUnitFee = change.stockBuyUnitFee ?? row.stockBuyUnitFee;
        }
        if (change.instockCnt != null) {
          // 不传 buyUnitFee：模拟客户端；服务端用库里 buyUnitFee 做 parseInstockCnt 目标
          item.instockCnt = change.instockCnt;
        }
        return item;
      });
    return {
      noteItems,
      warehouseGroupId: variable.warehouse.warehouseGroupId,
      warehouseId: variable.warehouse.warehouseId
    };
  }
}

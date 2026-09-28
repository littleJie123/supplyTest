import { HttpAction } from "testflow";

interface ItemChange {
  /** 物料名称，与 noteItems 中 name 匹配 */
  name: string;
  price?: number;
  /** 价格单位系数，必填 */
  stockBuyUnitFee: number;
  /** 不传则不改入库数量；口径为 buyUnitFee */
  instockCnt?: number;
  /** 数量单位系数，必填 */
  buyUnitFee: number;
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
          materialId: row.materialId,
          buyUnitFee: change.buyUnitFee,
          stockBuyUnitFee: change.stockBuyUnitFee
        };
        if (change.price != null) {
          item.price = change.price;
        }
        if (change.instockCnt != null) {
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

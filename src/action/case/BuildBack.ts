import { BaseTest, TestCase } from "testflow";
import Action from "../Action";
import BuildUpdateStock from "./BuildUpdateStock";

interface Opt {
  dayCnt?: number
  defVal?: number;
}
export default class extends TestCase {
  private opt: Opt;
  constructor(opt: Opt) {
    super();
    this.opt = opt;
  }
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [
      new Action({
        url: '/app/noteItem/listNoteItem',
        param: {
          noteId: '${noteIds}'
        },
        name: '查询noteItem'
      }, {
        buildVariable: (result) => {
          result = result.result;
          let content: any = result.content;
          let defVal = this.opt?.defVal ?? 2;
          return {
            noteItems: content.map(row => ({
              noteItemId: row.noteItemId,
              "stockUnitsId": row.stockUnitsId,
              "cnt": defVal,
              "buyUnitFee": row.buyUnitFee,
              "price": row.price,
              "supplierId": row.supplierId,
              "materialId": row.materialId,
              "stockBuyUnitFee": row.stockBuyUnitFee
            }))
          }
        }
      }),

      new Action({
        name: '创建退货单',
        url: '/app/noteBack/createNoteBack',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          items: '${noteItems}'
        }
      })
    ]
    let dayCnt = this.opt?.dayCnt ?? 0;
    if (dayCnt > 0) {
      ret.push(new BuildUpdateStock({
        dayCnt,
        tables: ['note', 'noteItem', 'stockRecord']
      }))
    }
    return ret;
  }
  getName(): string {
    return '构建退货单'
  }

}
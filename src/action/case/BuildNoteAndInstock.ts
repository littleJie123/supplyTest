import { ArrayUtil, BaseTest, DateUtil, TestCase } from "testflow";
import Action from "../Action";
import ListNoteGroup from "../note/ListNoteGroup";
import BatchProcessNote from "../note/BatchProcessNote";
import BuildUpdateStock from "./BuildUpdateStock";


interface Opt {
  materialCnt?: number;
  dayCnt?: number
  cntMap?: any
  priceMap?: any
  defPrice?: number;
  defCnt?: number
}
export default class extends TestCase {


  private opt: Opt
  constructor(opt?: Opt) {

    super();
    this.opt = opt
  }
  protected buildActions(): BaseTest[] {
    return [
      ... this.buildNote()
    ]
  }

  getMaterialCnt() {
    return this.opt.materialCnt ?? 5;
  }
  getName(): string {
    return '创建订单并且入库，并且修改时间'
  }

  private getValue(type: string, name: string, defVal: any) {
    let opt = this.opt;
    if (opt == null || opt[type] == null) {
      return defVal;
    }
    let map = opt[type];
    return map[name] ?? defVal;
  }
  private buildNote(): BaseTest[] {


    let buyUnitFee = 1;

    let ret: BaseTest[] = [];
    let items: any[] = [];
    let defPrice = this.opt?.defPrice ?? 1
    for (let i = 0; i < this.getMaterialCnt(); i++) {

      let name = `物料${i}`
      let cnt = this.getValue('cntMap', name, this.opt?.defCnt ?? 10);
      let price = this.getValue('priceMap', name, defPrice);

      items.push({
        "materialId": `\${materialMap.${name}.materialId}`,
        "supplierId": '${supplierMap.供应商1}',
        "cnt": cnt,
        "buyUnitFee": buyUnitFee,
        "stockUnitsId": 0,
        "price": price,
        "stockBuyUnitFee": 1
      })
    }

    ret.push(new Action({
      name: `下单${this.getMaterialCnt()}个物料`,
      url: '/app/note/createNote',
      method: 'post',
      param: {
        items,
        "warehouseId": '${warehouse.warehouseId}',
        "warehouseGroupId": '${warehouse.warehouseGroupId}'
      }
    }, {
      buildVariable(result: any) {
        let ret: any = {}
        let content: any[] = result.result;
        ret.noteIds = ArrayUtil.toArray(content, 'noteId')
        ret.note = content[0]
        return ret;
      }
    }))
    ret.push(new Action({
      url: '/app/note/sendNote',
      name: '发送订单',
      param: {
        noteIds: '${noteIds}',
        status: 'normal'
      }
    }));
    ret.push(new ListNoteGroup({
      groupType: 'NoteDay',
      status: 'normal',

    })),
      ret.push(new BatchProcessNote({
        action: 'instock'
      }))
    ret.push(
      ... new BuildUpdateStock(this.opt).getActions()
    )
    return ret;
  }


}
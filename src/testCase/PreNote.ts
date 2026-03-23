import { TestCase, BaseTest, ArrayUtil } from "testflow";
import Action from "../action/Action";
import BuildUpdateStock from "../action/case/BuildUpdateStock";
import BatchProcessNote from "../action/note/BatchProcessNote";
import ListNoteGroup from "../action/note/ListNoteGroup";

interface Opt {
  day?: number;
  needInstock?: boolean;
  needStatement?: boolean;
  handInstock?: boolean
  supplier?: string
  cnt?: number
  buyUnitFee?: number
  price?: number;
  instockCnt?: number;
  yieldRate?: number

  names?: string[]
  stockBuyUnitFee?: number
}

export default class extends TestCase {

  private theOpt: Opt;
  constructor(opt: Opt) {

    super();
    this.theOpt = opt
  }

  protected buildActions(): BaseTest[] {
    let opt = this.theOpt;
    let day = opt.day ?? 1;
    let names = opt.names ?? ['猪肉', '白菜', '鸡蛋']
    let price = opt?.price ?? 2;
    let cnt = opt?.cnt ?? 100
    let buyUnitFee = opt?.buyUnitFee ?? 1;
    let stockBuyUnitFee = opt?.stockBuyUnitFee ?? 1;

    let ret: BaseTest[] = [];
    let items: any[] = [];
    for (let i = 0; i < names.length; i++) {
      let name = names[i]
      items.push({
        "materialId": `\${materialMap.${name}.materialId}`,
        "supplierId": '${supplierMap.' + (opt?.supplier ?? '供应商1') + '}',
        "cnt": cnt,
        "buyUnitFee": buyUnitFee,
        "stockUnitsId": 0,
        "price": price,
        "stockBuyUnitFee": stockBuyUnitFee,
        "yieldRate": opt?.handInstock ? (opt?.yieldRate ?? 0) : 0
      })

    }

    ret.push(new Action({
      name: `下单物料`,
      url: opt?.handInstock ? '/app/note/createHandInstock' : '/app/note/createNote',
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
    if (!opt?.handInstock) {
      ret.push(new Action({
        url: '/app/note/sendNote',
        name: '发送订单',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }));
      if (opt?.needInstock || opt?.needStatement) {
        ret.push(new ListNoteGroup({
          groupType: 'NoteDay',
          status: 'normal',

        }));
        ret.push(new Action({
          name: '入库',
          url: '/app/note/processNote',
          param: {
            "noteId": '${note.noteId}',

            "action": "instock",
            "warehouseId": '${warehouse.warehouseId}',
          }
        }, {
          parseHttpParam: (ret: any, variable) => {


            let noteItems: any[] = variable.note.noteItems;
            noteItems = noteItems.map(row => ({
              "noteItemId": row.noteItemId,
              "cnt": row.cnt,
              "instockCnt": opt?.instockCnt ?? row.cnt,

              "price": row.price,
              "stockBuyUnitFee": row.stockBuyUnitFee,
              "materialId": row.materialId,
              "yieldRate": opt?.yieldRate ?? 0
            }))
            ret.noteItems = noteItems;
            return ret;
          }
        }))

      }

      if (opt?.needStatement) {
        ret.push(new ListNoteGroup({
          groupType: 'NoteDay',
          status: 'instocked',

        }));
        ret.push(new BatchProcessNote({
          action: 'statement'
        }))



      }

    }
    ret.push(
      ... new BuildUpdateStock({
        dayCnt: day,
        tables: ['stockRecord', 'note', 'noteItem']
      }).getActions()
    )
    return ret;
  }

  getName(): string {
    return '创建订单'
  }
  needInScreen(): boolean {
    return false;
  }
}
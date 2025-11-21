import { ArrayUtil, BaseTest, DateUtil, TestCase } from "testflow";
import FindLastUserId from "../action/user/FindLastUserId";
import AddSupplier from "../action/supplier/AddSupplier";
import ListSupplier from "../action/supplier/ListSupplier";
import GetOpenId from "../action/user/GetOpenId";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import AddMaterial from "../action/material/AddMaterial";
import Action from "../action/Action";
import BatchProcessNote from "../action/note/BatchProcessNote";
import ListNoteGroup from "../action/note/ListNoteGroup";
import ListMaterial from "../action/material/ListMaterial";
const S_MaterialCnt = 800;
const S_NoteCnt = 40;
const S_DayCnt = 20

// const S_MaterialCnt = 10;
// const S_NoteCnt = 10;
// const S_DayCnt = 20

/**
 * 产生一个90天的订单数据
 */
export default class extends TestCase {
  private beginMaterial = 0;
  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new AddSupplier('供应商1'),
      new AddSupplier('供应商2'),
      new ListSupplier(),

      ... this.build800Material(),
      ... this.build90Day(),
      ... this.buildState()
    ]
  }

  buildState() {
    let date = DateUtil.beforeDay(new Date(), S_DayCnt)
    let end = DateUtil.beforeDay(new Date(), 1)
    return [new Action({
      url: '/app/state/stateWarehouse',
      name: '正式统计',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        opening: DateUtil.format(date),
        end: DateUtil.format(end)
      }
    }, {
    })]
  }
  getName(): string {
    return "90天大订单数据"
  }

  private build800Material(): BaseTest[] {
    let ret: BaseTest[] = []
    let materials: any[] = []
    for (let i = 0; i < S_MaterialCnt; i++) {
      materials.push({
        name: this.buildName(i),
        stockUnitsId: 18,
        unitsId: 18,
        buyUnitsId: 132,
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      })
    }
    ret.push(new Action({
      name: '批量增加物料',
      param: {
        array: materials,
        table: 'material'
      },
      url: '/free/add'
    }, {
      buildVariable(result) {
        return {
          materialMap: ArrayUtil.toMapByKey(result.result, 'name')
        }
      }
    }))
    return ret;
  }

  private build90Day(): BaseTest[] {
    let ret: BaseTest[] = []
    for (let i = S_DayCnt - 1; i >= 0; i--) {
      ret.push(
        ... this.buildDay(i)
      )
    }
    return ret;
  }

  private buildDay(day: number): BaseTest[] {
    let ret: BaseTest[] = []
    ret.push(... this.buildNote(day))
    if (day % 5 == 0 && day != S_NoteCnt) {
      ret.push(... this.buildInventory(day));
    } else if (day % 15 == 0) {
      ret.push(... this.buildBack(day));
    }
    ret.push(... this.buildUpdateStock(day))
    return ret;
  }

  private buildNote(day: number): BaseTest[] {
    let price = 1;
    let cnt = 10
    let buyUnitFee = 1;
    if (day % 2 == 0) {

      cnt = 1
      buyUnitFee = -10;
    }
    let ret: BaseTest[] = [];
    let items: any[] = [];
    for (let i = 0; i < S_NoteCnt; i++) {
      let name = this.buildName(this.beginMaterial + i)
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
    this.beginMaterial += S_NoteCnt;
    ret.push(new Action({
      name: `下单${S_NoteCnt}个物料`,
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
    return ret;
  }

  private buildName(index: number): string {
    index = index % S_MaterialCnt;
    return '物料' + index;
  }
  private buildInventory(day: number): BaseTest[] {
    let ret: BaseTest[] = [];
    let array: any = []
    let inventoryDay = DateUtil.beforeDay(new Date(), day)
    for (let i = 0; i < S_MaterialCnt; i++) {
      let name = this.buildName(i);
      array.push({
        materialId: `\${materialMap.${name}.materialId}`,
        buyUnitFee: 1,
        cnt: 5
      })
    }
    ret.push(new Action({
      url: '/free/stock',
      name: '盘点',
      param: {
        action: 'set',
        array,
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }
    }))

    ret.push(new Action({
      url: '/free/add',
      name: '增加盘点记录',
      param: {
        table: 'inventory',
        array: array.map(row => ({
          materialId: row.materialId,
          cnt: row.cnt,
          status: 'finished',
          buyUnitFee: row.buyUnitFee,
          inventoryDay: DateUtil.format(inventoryDay),
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }))
      }
    }))
    return ret;
  }

  private buildBack(day: number): BaseTest[] {
    let variable = this.getVariable()
    return [

      new Action({
        name: '退货',
        url: '/app/noteBack/createNoteBack',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        parseHttpParam(param) {
          let noteItems: any[] = variable.note.noteItems;
          param.items = noteItems.map(row => ({
            "stockUnitsId": 18,
            "cnt": 2,
            "buyUnitFee": 1,
            "price": 1,
            "noteItemId": row.noteItemId,
            "supplierId": row.supplierId,
            "materialId": row.materialId,
            "stockBuyUnitFee": 1
          }))
          return param;
        },
      })
    ];
  }

  private buildUpdateStock(day: number): BaseTest[] {
    let ret: BaseTest[] = [];
    let tables: string[] = ['stock', 'stockRecord', 'note', 'noteItem', 'inventory'];

    let date = DateUtil.beforeDay(new Date(), day);

    if (day > 0) {
      for (let table of tables) {
        ret.push(new Action(
          {
            name: `更新第${day}天${table}数据`,
            param: {
              table: table,
              cdts: [
                {
                  val: '${warehouse.warehouseId}',
                  col: 'warehouseId'
                },
                {
                  val: DateUtil.todayStr(),
                  col: 'sysAddTime',
                  op: '>='
                }
              ],
              data: {
                sysAddTime: DateUtil.formatDate(date)
              }
            },
            url: '/free/update'
          }
        ))
      }

    }
    return ret;
  }
}
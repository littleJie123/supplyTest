import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import ListSupplier from "../action/supplier/ListSupplier";
import AddSupplier from "../action/supplier/AddSupplier";
import FindLastUserId from "../action/user/FindLastUserId";
import GetOpenId from "../action/user/GetOpenId";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import AddMaterial from "../action/material/AddMaterial";
import Action from "../action/Action";
import BatchProcessNote from "../action/note/BatchProcessNote";
import ListNoteGroup from "../action/note/ListNoteGroup";
import { WarehouseType } from "../inf/IOpt";
import BuildMaterial from "../action/material/BuildMaterial";
import ListMaterial from "../action/material/ListMaterial";
import QueryAction from "../action/QueryAction";
import SaveShareData from "../action/shareData/SaveShareData";

export default class extends TestCase {
  getName(): string {
    return "测试红点"
  }

  buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new AddSupplier('供应商1'),
      new AddSupplier('供应商2'),
      new ListSupplier(),
      new BuildMaterial(),
      new ListMaterial(),
      ... this.buildNote(),
      new QueryAction({
        name: '查询订单',
        url: '/app/note/listNote',
        query: {
          status: 'instocked'
        }
      }, {
        buildVariable(result) {
          return {
            noteMap: ArrayUtil.toMapByKey(result.result.content, 'supplierName', 'noteId')
          }
        }
      }),
      new SaveShareData({
        data: {
          noteId: "${noteMap.供应商1}"
        }
      }),
      new AddWarehouse({
        name: '新供应商',
        variableType: 'supplierWarehouse',
        type: 'supplier'

      }),
      new Action({
        url: '/app/note/linkNote',
        name: '接单',
        param: {
          warehouseId: "${supplierWarehouse.warehouseId}",
          _shareDataNo: "${shareDataNo}",
        }

      }, {
        warehouseType: 'supplierWarehouse'
      }),
      this.buildCheckNote({
        warehouseType: 'supplierWarehouse',
        status: 'accept',
        cnt: 1
      }),
      this.buildSchRedPoint({
        zeroCnt: 0,
        notZeroCnt: 0,
        warehouseType: 'supplierWarehouse'
      }),
      ... this.buildNote(),
      this.buildSchRedPoint({
        zeroCnt: 1,
        notZeroCnt: 1,
        warehouseType: 'supplierWarehouse'
      }),
      ... this.buildNote(),
      this.buildSchRedPoint({
        zeroCnt: 1,
        notZeroCnt: 2,
        warehouseType: 'supplierWarehouse'
      })
    ];
  }

  private buildSchRedPoint(param: {
    warehouseType?: WarehouseType,
    zeroCnt: number,
    notZeroCnt: number
  }): BaseTest {
    let warehouse = param.warehouseType ?? 'warehouse';
    return new Action({
      url: '/free/query',
      name: '检查红点表',
      param: {
        array: [{
          table: 'redPoint',
          query: {
            warehouseGroupId: `\${${warehouse}.warehouseGroupId}`
          }
        }]
      }

    }, {
      check(result) {
        let content: any[] = result.result.redPoint;
        let notZeroCnt = content.filter(row => row.tableId != 0).length;
        let zeroCnt = content.length - notZeroCnt;

        if (param.zeroCnt != null) {
          CheckUtil.expectEqual(zeroCnt, param.zeroCnt)
        }
        if (param.notZeroCnt != null) {
          CheckUtil.expectEqual(notZeroCnt, param.notZeroCnt)
        }
      }
    });
  }


  private buildCheckNote(param: {
    warehouseType?: WarehouseType,
    status?: string,
    cnt: number
  }): BaseTest {
    return new QueryAction({
      name: '检查订单',
      url: '/app/note/listNote',
      query: {
        status: param.status,
        warehouseId: `\${${param.warehouseType ?? 'warehouse'}.warehouseId}`
      }
    }, {
      warehouseType: param.warehouseType,
      check(result) {
        let content: any[] = result.result.content;
        CheckUtil.expectEqual(content.length, param.cnt)
      },
    })
  }

  private buildName(num: number) {
    return '物料' + num;
  }

  private buildNote(warehouse?: WarehouseType): BaseTest[] {
    if (warehouse == null) {
      warehouse = 'warehouse'
    }
    let price = 1;
    let cnt = 10
    let buyUnitFee = 1;

    let ret: BaseTest[] = [];
    let items: any[] = [];

    let name = this.buildName(1)
    items.push({
      "materialId": `\${materialMap.${name}.materialId}`,
      "supplierId": '${supplierMap.供应商1}',
      "cnt": cnt,
      "buyUnitFee": buyUnitFee,
      "stockUnitsId": 0,
      "price": price,
      "stockBuyUnitFee": 1
    })


    ret.push(new Action({
      name: `下单物料`,
      url: '/app/note/createNote',
      method: 'post',
      param: {
        items,
        "warehouseId": '${warehouse.warehouseId}',
        "warehouseGroupId": `\${${warehouse}.warehouseGroupId}`
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

    }));
    ret.push(new BatchProcessNote({
      action: 'instock'
    }))
    return ret;
  }
}
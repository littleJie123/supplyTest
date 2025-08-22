import { ArrayUtil, BaseTest, TestCase } from "testflow";
import PreTest from "./PreTest";
import Action from "../action/Action";
import ListMaterial from "../action/material/ListMaterial";
import SaveMaterial from "../action/material/SaveMaterial";
import CreateNote3M from "../action/note/CreateNote3M";
import QueryAction from "../action/QueryAction";
import SaveShareData from "../action/shareData/SaveShareData";
import ChangeWarehouse from "../action/user/ChangeWarehouse";
import AddWarehouse from "../action/warehouse/AddWarehouse";

export default class extends TestCase {
  getName(): string {
    return '初始化餐厅|供应商|物料|订单'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest(),
      new ListMaterial(),

      new CreateNote3M(),
      new AddWarehouse({
        name: '新供应商',
        variableType: 'supplierWarehouse',
        type: 'supplier'

      }),
      new SaveMaterial({
        name: '羊肉',
        buyUnit: [
          { "name": "克", "fee": 1 },
          { "isSupplier": true, "name": "瓶", "fee": 500 }
        ]
      }, {
        warehouseType: 'supplierWarehouse'
      }),
      new QueryAction({
        name: '查询订单',
        url: '/app/note/listNote',
        query: {
          status: 'normal'
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
      new Action({
        url: '/share/shareNote',
        name: '查询分享单',
        param: {
          "shareDataNo": "${shareDataNo}",
          "usersId": "${usersId}",
        }
      }),
      new ChangeWarehouse(),
      new Action({
        url: '/share/linkNote',
        name: '接单',
        param: {
          warehouseId: "${supplierWarehouse.warehouseId}",
          shareDataNo: "${shareDataNo}",
        }

      }, {
        warehouseType: 'supplierWarehouse'
      }),
    ]
  }
}
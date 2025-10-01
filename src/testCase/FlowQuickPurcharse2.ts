import { BaseTest, TestCase } from "testflow";
import ListMaterial from "../action/material/ListMaterial";
import CreateNote3M from "../action/note/CreateNote3M";
import PreTest from "./PreTest";
import QueryAction from "../action/QueryAction";
import Action from "../action/Action";
import AddMaterial from "../action/material/AddMaterial";
import UpdateMaterial from "../action/material/UpdateMaterial";
import AddSupplier from "../action/supplier/AddSupplier";
import FindLastUserId from "../action/user/FindLastUserId";
import GetOpenId from "../action/user/GetOpenId";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import ListSupplier from "../action/supplier/ListSupplier";

function format(date: Date): string {

  var str = ''
  str = date.getFullYear() + '-'
  var month = date.getMonth() + 1
  if (month < 10) {
    str = str + '0'
  }
  str += month
  str = str + '-'
  var day = date.getDate()
  if (day < 10) {
    str = str + '0'
  }
  str += day
  return str
}
function getToday(): string {
  let date = new Date()
  return format(date);
}

function beforeDay(strDate: string, num: number, onlyDay?: boolean): string {
  let date = new Date(strDate);
  date.setTime(date.getTime() - num * 24 * 3600 * 1000);
  if (onlyDay) {
    return format(date);
  }
  return format(date) + ' 12:00:00'
}

export default class extends TestCase {
  getName(): string {
    return '快捷发货【供货商版本】';
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse({
        name: '新供应商',
        variableType: 'warehouse',
        type: 'supplier'

      }),
      new AddSupplier('小杰餐厅', {
        type: 'store'
      }),

      new AddSupplier('小翕餐厅', {
        type: 'store'
      }),
      new ListSupplier(),
      new AddMaterial('猪肉', {
        buyUnit: [
          { "name": "瓶" }, { "name": "箱", isSupplier: true, fee: 10 }
        ],
        suppliers: []
      }),
      new AddMaterial('羊肉', {
        suppliers: []
      }),
      new UpdateMaterial('羊肉', {
        suppliers: []
      }),
      new AddMaterial('牛肉', {
        suppliers: []
      }),
      new ListMaterial(),
      new CreateNote3M({
        supplier:'${supplierMap.小杰餐厅}',
        checkNotes:[]
      }),

      new CreateNote3M({
        supplier:'${supplierMap.小翕餐厅}',
        checkNotes:[]
      }),
      ... this.createUpdateActions(1),
      new CreateNote3M({
        supplier:'${supplierMap.小杰餐厅}',
        checkNotes:[]
      }),
      new CreateNote3M({
        supplier:'${supplierMap.小翕餐厅}',
        checkNotes:[]
      }),
      ... this.createUpdateActions(7)
    ]


  }

  protected createUpdateActions(num: number): BaseTest[] {
    return [
      new QueryAction({
        url: '/app/note/listNote',

      }, {
        buildVariable(result) {
          let content: any[] = result.result.content;
          let list = content.filter(row => {
            return format(new Date(row.sysAddTime)) == getToday()
          })
          return {
            "array": list.map(row => ({
              noteId: row.noteId,
              sysAddTime: beforeDay(row.sysAddTime, num)
            }))
          }
        }
      }),
      new Action({
        url: '/free/update',
        name: '更改日期',
        param: {
          table: 'note',
          action: 'updateArray',
          array: '${array}'
        }
      })
    ]
  }
}
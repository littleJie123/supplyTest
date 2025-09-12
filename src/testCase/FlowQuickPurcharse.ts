import { BaseTest, TestCase } from "testflow";
import ListMaterial from "../action/material/ListMaterial";
import CreateNote3M from "../action/note/CreateNote3M";
import PreTest from "./PreTest";
import QueryAction from "../action/QueryAction";
import Action from "../action/Action";

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
    return '快捷订货';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest(),
      new ListMaterial(),
      //第一页面批量处理
      new CreateNote3M(),

      ... this.createUpdateActions(2),
      new CreateNote3M(),
      ... this.createUpdateActions(1),
      new CreateNote3M(),
      new CreateNote3M(),
      ... this.createUpdateActions(3),
      new QueryAction({
        url: '/app/noteItem/listNoteItemHis',
        query: {
          warehouseId: '${warehouse.warehouseId}',
          day: beforeDay(getToday(), 3, true)
        },
        checkers: {
          checkArray: [
            {
              "name": "猪肉",
              "purcharse": {
                "buyUnitFee": 1,
                "cnt": 800,
                "stockUnitsId": 0
              }
            }
          ]
        }
      })
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
import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import PreNote from "../PreNote";
import Action from "../../action/Action";
import QueryAction from "../../action/QueryAction";
import CheckArray from "../../action/CheckArray";

function listNoteHis(opt: {
  name: string
  remark: string
  checkArray: any[]
  check?(result)
}) {
  return new QueryAction({
    name: opt.name,
    url: '/app/updateHis/listNoteUpdateHis',
    query: {
      noteId: '${note.noteId}'
    },
    checkers: {
      checkArray: opt.checkArray
    }
  }, {
    check: opt.check
  }).setRemark(opt.remark)
}

function findHis(result: any, pred: (row: any) => boolean): any {
  return (result.result.content ?? []).find(pred)
}

function checkNoteRow(row: any, action: string) {
  CheckUtil.expectNotNull(row)
  CheckUtil.expectEqual(row.tableName, 'note')
  CheckUtil.expectEqual(row.action, action)
  CheckUtil.expectEqual(row.parentTable, 'note')
  CheckUtil.expectEqual(row.parentId, row.tableId)
  CheckUtil.expectNotNull(row.data?.detail)
  CheckUtil.expectEqual(row.data?.oldData == null, true)
  CheckUtil.expectEqual(row.data?.newData == null, true)
}

/**
 * 结算 / 取消结算订单（见同目录 FlowStatementNote.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '入库后结算（金额可改）再取消结算，校验状态、金额、明细和更改记录' })
  }

  getName(): string {
    return '结算订单'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest().setRemark('初始化餐厅、供应商、物料'),

      new PreNote({
        names: ['猪肉'],
        cnt: 10,
        price: 2,
        needInstock: true
      }).setRemark('下单猪肉 10、单价 2，发单并入库，instockCost=20'),

      new Action({
        name: '结算订单',
        remark: 'statmentNote：结算金额改为 88（入库金额 20）',
        url: '/app/note/statmentNote',
        param: {
          noteId: '${note.noteId}',
          statementCost: 88,
          warehouseId: '${warehouse.warehouseId}'
        }
      }),

      new CheckArray([{
        table: 'note',
        query: {
          noteId: '${note.noteId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '应有1条订单')
          CheckUtil.expectEqual(array[0].status, 'statement', '订单应变为已结算')
          CheckUtil.expectEqual(array[0].statementCost, 88, '结算金额应为用户提交的 88')
        }
      }, {
        table: 'noteItem',
        query: {
          noteId: '${note.noteId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '应有1条明细')
          CheckUtil.expectEqual(array[0].instockCnt, 10)
          CheckUtil.expectEqual(array[0].instockCost, 20)
          CheckUtil.expectEqual(array[0].statementCnt, 10, 'statementCnt 应等于 instockCnt')
          CheckUtil.expectEqual(array[0].statementCost, 20, 'statementCost 应等于 instockCost')
        }
      }]).setRemark('校验结算后订单状态/金额，明细 statement 抄入库值'),

      listNoteHis({
        name: '查询结算历史',
        remark: 'statement 只记 note，detail=title，不写 noteItem',
        checkArray: [
          {
            action: 'statement',
            tableName: 'note',
            parentTable: 'note',
            data: {
              remark: '结算'
            }
          }
        ],
        check(result) {
          CheckUtil.expectNotFind(result.result.content ?? [], { tableName: 'noteItem', action: 'statement' })
          let row = findHis(result, item => item.tableName == 'note' && item.action == 'statement')
          checkNoteRow(row, 'statement')
          CheckUtil.expectEqual(row.data?.remark, '结算')
        }
      }),

      new Action({
        name: '取消结算',
        remark: 'cancelStatmentNote：状态改回 instocked，结算金额 0',
        url: '/app/note/cancelStatmentNote',
        param: {
          noteId: '${note.noteId}',
          warehouseId: '${warehouse.warehouseId}'
        }
      }),

      new CheckArray([{
        table: 'note',
        query: {
          noteId: '${note.noteId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '应有1条订单')
          CheckUtil.expectEqual(array[0].status, 'instocked', '订单应改回未结算')
          CheckUtil.expectEqual(array[0].statementCost, 0, '结算金额应设成 0')
        }
      }, {
        table: 'noteItem',
        query: {
          noteId: '${note.noteId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '应有1条明细')
          CheckUtil.expectEqual(array[0].statementCnt == null, true, 'statementCnt 应清空')
          CheckUtil.expectEqual(array[0].statementCost == null, true, 'statementCost 应清空')
        }
      }]).setRemark('校验取消结算后订单状态/金额，明细 statement 清空'),

      listNoteHis({
        name: '查询取消结算历史',
        remark: 'cancelStatement 只记 note，不写 noteItem',
        checkArray: [
          {
            action: 'cancelStatement',
            tableName: 'note',
            parentTable: 'note',
            data: {
              remark: '取消结算'
            }
          }
        ],
        check(result) {
          CheckUtil.expectNotFind(result.result.content ?? [], { tableName: 'noteItem', action: 'cancelStatement' })
          let row = findHis(result, item => item.tableName == 'note' && item.action == 'cancelStatement')
          checkNoteRow(row, 'cancelStatement')
          CheckUtil.expectEqual(row.data?.remark, '取消结算')
        }
      })
    ]
  }
}

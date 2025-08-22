import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreWarehouseAndSupplier from "./PreWarehouseAndSupplier";
import Action from "../action/Action";
import QueryAction from "../action/QueryAction";

export default class extends TestCase {
  getName(): string {
    return '评论流程'
  }
  protected buildActions(): BaseTest[] {
    return [
      new PreWarehouseAndSupplier(),
      new Action({
        name: '订单打分',
        url: '/app/note/setRate',
        param: {
          tableId: '${noteMap.供应商1}',
          tableName: 'note',
          rate: 3,
          remark: '测试一下',
          rateType: 'normal',
          usersId: 1
        }

      }),
      new QueryAction({
        name: '查询打分',
        url: '/app/rateRemark/listRateRemark',
        query: {
          tableId: '${noteMap.供应商1}',
          tableName: 'note',
        },
        checkers: {
          len: 1,
          checkArray: [
            { remark: '测试一下', rate: 3 }
          ]
        }
      }),
      new Action({
        name: '修改打分',
        url: '/app/note/setRate',
        param: {
          tableId: '${noteMap.供应商1}',
          tableName: 'note',
          rate: 4,
          remark: '测试一下2',
          rateType: 'normal',
          usersId: 1
        }

      }),
      new QueryAction({
        name: '查询打分',
        url: '/app/rateRemark/listRateRemark',
        query: {
          tableId: '${noteMap.供应商1}',
          tableName: 'note',
        },
        checkers: {
          len: 1,
          checkArray: [
            { remark: '测试一下2', rate: 4 }
          ]
        }
      }),

      new Action({
        name: '不同用户打分',
        url: '/app/note/setRate',
        param: {
          tableId: '${noteMap.供应商1}',
          tableName: 'note',
          rate: 2,
          remark: '用户2',
          rateType: 'normal',
          usersId: 2
        }

      }),
      new QueryAction({
        name: '查询打分',
        url: '/app/rateRemark/listRateRemark',
        query: {
          tableId: '${noteMap.供应商1}',
          tableName: 'note',
        },
        checkers: {
          len: 2,
          checkArray: [
            { remark: '用户2', rate: 2 }
          ]
        }
      }),
      new QueryAction({
        name: '验证订单得分',
        url: '/app/note/listNote',
        query: {
          noteId: '${noteMap.供应商1}'
        },
        checkers: {
          checkArray: [
            { rate: 3 }
          ]
        }

      }, {
        buildVariable(result) {
          let content: any[] = result.result.content;
          return {
            linkNoteId: content[0].linkNoteId
          }
        },
      }),
      new Action({
        name: '不同状态打分',
        url: '/app/note/setRate',
        param: {
          tableId: '${noteMap.供应商1}',
          tableName: 'note',
          rate: 3,
          remark: '用户2-不同状态',
          rateType: 'instocked',
          usersId: 2
        }

      }),
      new QueryAction({
        name: '查询打分',
        url: '/app/rateRemark/listRateRemark',
        query: {
          tableId: '${noteMap.供应商1}',
          tableName: 'note',
        },
        checkers: {
          len: 3,
          checkArray: [
            { remark: '用户2-不同状态', rate: 3 }
          ]
        }
      }, {
        check(result) {
          let content: any[] = result.result.content;
          CheckUtil.expectNotFind(content, {
            rate: 2
          })
        }
      }),
      new Action({
        name: '不同状态打分',
        url: '/app/note/setRate',
        param: {
          tableId: '${noteMap.供应商1}',
          tableName: 'note',
          rate: 3,
          remark: '用户2-不同状态2',
          rateType: 'statement',
          usersId: 2
        }

      }),

      new QueryAction({
        name: '查询打分',
        url: '/app/rateRemark/listRateRemark',
        query: {
          tableId: '${noteMap.供应商1}',
          tableName: 'note',
        },
        checkers: {
          len: 4,
          checkArray: [
            { remark: '用户2-不同状态2' },
            { remark: '用户2-不同状态', rate: 3 }
          ]
        }
      }, {
        check(result) {
          let content: any[] = result.result.content;
          content = content.filter(row => row.rate == 3)
          CheckUtil.expectEqual(content.length, 1)
        }
      }),
      new QueryAction({
        name:'供应商查询评分',
        url:'/app/rateRemark/listRateRemark',
        query: {
          tableId: '${linkNoteId}',
          tableName: 'note',
        },
        checkers: {
          len: 4,
          checkArray: [
            { remark: '用户2-不同状态2' },
            { remark: '用户2-不同状态', rate: 3 }
          ]
        }
      },{
        warehouseType:'supplierWarehouse'
      }),
      new Action({
        name: '供应商评论',
        url: '/app/note/setRate',
        param: {
          tableId: '${linkNoteId}',
          tableName: 'note',
          remark: '供应商评分',
          rateType: 'normal',
          usersId: 2
        }

      },{
        warehouseType:'supplierWarehouse'
      }),
      new QueryAction({
        name:'供应商查询评分',
        url:'/app/rateRemark/listRateRemark',
        query: {
          tableId: '${linkNoteId}',
          tableName: 'note',
        },
        checkers: {
          len: 5,
          checkArray: [
            { remark: '用户2-不同状态2' },
            { remark: '用户2-不同状态', rate: 3 },
            {
              note:{
                warehouse:{name:'新供应商'}
              }
            },
            {
              note:{
                warehouse:{name:'新餐厅'}
              }
            }
          ]
        }
      },{
        warehouseType:'supplierWarehouse'
      }),
      new QueryAction({
        name:'查询物料[猪肉]',
        url:'/app/noteItem/listNoteItem',
        query:{
          noteId:'${noteMap.供应商1}'
        }
      },{
        buildVariable(result){
          let content:any[] = result.result.content;
          let item = content.find(row=>row.name=='猪肉');
          return {
            noteItemId:item.noteItemId,
            linkNoteItemId:item.linkNoteItemId
          }
        }
      }),
      new Action({
        name: '餐厅评论猪肉',
        url: '/app/note/setRate',
        param: {
          tableId: '${noteItemId}',
          tableName: 'noteItem',
          remark: '猪肉很好',
          rateType: 'normal',
          usersId: 2,
          rate:3

        }

      }),
      new Action({
        name: '餐厅评论猪肉2',
        url: '/app/note/setRate',
        param: {
          tableId: '${noteItemId}',
          tableName: 'noteItem',
          remark: '猪肉很好2',
          rateType: 'normal',
          usersId: 1,
          rate:4

        }

      }),
      new QueryAction({
        name:'查询物料[猪肉]',
        url:'/app/noteItem/listNoteItem',
        query:{
          noteItemId:'${noteItemId}'
        },
        checkers:{
          checkArray:[
            {
              rate:3.5
            }
          ]
        }
      }),
      new Action({
        name: '供应商评论',
        url: '/app/note/setRate',
        param: {
          tableId: '${linkNoteItemId}',
          tableName: 'noteItem',
          remark: '供应商评分',
          rateType: 'normal',
          usersId: 3
        }

      },{
        warehouseType:'supplierWarehouse'
      }),
      new QueryAction({
        name:'验证评分',
        url:'/app/rateRemark/listRateRemark',
        query:{
          tableId: '${linkNoteItemId}',
          tableName: 'noteItem',
        },
        checkers:{
          len:3,
          checkArray:[
            {remark:'猪肉很好',rate:3},
            {remark:'猪肉很好2',rate:4},
            {remark:'供应商评分'}
          ]
        }
      },{
        warehouseType:'supplierWarehouse'
      })
    ]
  }
}
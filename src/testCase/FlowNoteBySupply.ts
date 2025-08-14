import { ArrayUtil, BaseTest, CheckUtil, HttpAction, TestCase } from "testflow";
import AddMaterial from "../action/material/AddMaterial";
import PreTest from "./PreTest";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import ListMaterial from "../action/material/ListMaterial";
import CreateNote3M from "../action/note/CreateNote3M";
import QueryAction from "../action/QueryAction";
import SaveShareData from "../action/shareData/SaveShareData";
import Action from "../action/Action";
import ChangeWarehouse from "../action/user/ChangeWarehouse";
import ListNoteGroup from "../action/note/ListNoteGroup";
import BatchProcessNote from "../action/note/BatchProcessNote";
import ConfirmBill from "../action/bill/ConfirmBill";
import SaveMaterial from "../action/material/SaveMaterial";
import Fraction from "../util/Fraction";
import NoteItemUtil from "../util/NoteItemUtil";

export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    let variable = this.getVariable()
    return [
      new PreTest(),
      new AddMaterial('狗肉', {
        suppliers: [
          {
            "isDef": true,
            "supplierId": "${supplierMap.供应商1}",

            "price": 10
          }]
      }),

      new ListMaterial(),

      new CreateNote3M(),
      new AddWarehouse({
        name: '新供应商',
        variableType: 'supplierWarehouse',
        type: 'supplier'

      }),
      new SaveMaterial({
        name:'羊肉',
        buyUnit:[
          { "name": "克", "fee": 1 },
          { "isSupplier": true, "name": "瓶", "fee": 500 }
        ]
      },{
        warehouseType:'supplierWarehouse'
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
      new QueryAction({
        name: '查询物料',
        url: '/app/material/listMaterial4Supplier',
        query: {
          warehouseId: "${supplierWarehouse.warehouseId}"
        },
        checkers: {
          len: 2,
          checkArray: [
            { name: '猪肉' },
            { name: '羊肉' }
          ]
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),

      new QueryAction({
        name: '查询订单',
        url: '/app/note/listNote',
        query: {
          status: 'accept'
        },
        checkers: {
          len: 1
        }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content: any[] = result.result.content;
          return {
            linkNoteId: content[0].linkNoteId
          }
        }
      }),
      new QueryAction({
        name: '验证订单',
        url: '/app/note/listNote',
        query: {
          noteId: '${linkNoteId}'
        },
        checkers: {
          len: 1
        }
      }, {
        buildVariable(result) {
          let content = result.result.content;
          CheckUtil.expectEqual(content[0].noteId, variable.linkNoteId)
        }

      }),

      new QueryAction({
        name: '查询供应商',
        url: '/app/supplier/listSupplier',
        checkers: {
          len: 1
        }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content: any[] = result.result.content;
          return {
            linkSupplierId: content[0].linkSupplierId
          }
        }
      }),
      new QueryAction({
        name: '验证供应商',
        url: '/app/supplier/listSupplier',
        query: {
          supplierId: '${linkSupplierId}'
        },
        checkers: {
          len: 1
        }
      }, {
        buildVariable(result) {
          let content = result.result.content;
          CheckUtil.expectEqual(content[0].supplierId, variable.linkSupplierId)
        }

      }),
      new CreateNote3M(),
      new ListNoteGroup({
        len: 1,
        noteCnt: 1,
        type: 'Type4Supplier'
      }, {
        warehouseType: 'supplierWarehouse',

      }),

      new BatchProcessNote({
        action: 'accept'
      }, {
        warehouseType: 'supplierWarehouse'
      }),


      new ListNoteGroup({
        len: 1,
        noteCnt: 2,
        status: 'accept',
        type: 'Type4Supplier'
      }, {
        warehouseType: 'supplierWarehouse',

      }),

      new BatchProcessNote({
        action: 'send'
      }, {
        warehouseType: 'supplierWarehouse'
      }),

      new ListNoteGroup({
        len: 1,
        noteCnt: 2,
        status: 'sended',
        type: 'Type4Supplier'
      }, {
        warehouseType: 'supplierWarehouse',

      }),

      new BatchProcessNote({
        action: 'instock',

      }, {
        warehouseType: 'supplierWarehouse'
      }),

      new ListNoteGroup({
        len: 1,
        noteCnt: 2,
        status: 'instocked',
        type: 'Type4Supplier'
      }, {
        warehouseType: 'supplierWarehouse',

      }),
      new BatchProcessNote({
        action: 'statement'
      }, {
        warehouseType: 'supplierWarehouse',
      }),
      new ConfirmBill({
        warehouseType: 'supplierWarehouse',

      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'statement',
        type: 'Type4Supplier',
        len: 1,
        noteCnt: 2
      }, {
        warehouseType: 'supplierWarehouse',

      }),

      new QueryAction({
        name: '查询订单',
        url: '/app/note/listNote'
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content: any[] = result.result.content
          return {
            noteIds: ArrayUtil.toArray(content, 'noteId')
          }
        }
      }),

      new QueryAction({
        name: '查询订单物料',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: "${noteIds}"
        }
      }, {
        warehouseType: 'supplierWarehouse',
        check(result) {
          let content = result.result.content;
          for (let row of content) {
            CheckUtil.expectEqualObj(row.purcharse, row.instock)
            CheckUtil.expectEqualObj(row.purcharse, row.sendCnt)
          }
        },
        buildVariable(result) {
          let content:any[] = result.result.content
          let row = content.find(item=>item.name == '羊肉')
          
          return {
            linkNoteItemId: ArrayUtil.toArray(
              content,
              'linkNoteItemId'
            ),
            cntAndPrice:{
              cnt :new Fraction(row.purcharse.buyUnitFee,1).cal( row.purcharse.cnt),
              price:new Fraction(1,row.stockBuyUnitFee).cal( row.price)
            }
          }
        },
      }),
      new QueryAction({
        name: '查询订单物料',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteItemId: "${linkNoteItemId}"
        }
      }, {
        check(result) {
          
          let content = result.result.content;
          let row = content.find(item=>item.name == '羊肉')
          let cnt =new Fraction(row.purcharse.buyUnitFee,1).cal( row.purcharse.cnt)
          let price = new Fraction(1,row.stockBuyUnitFee).cal( row.price)
          CheckUtil.expectEqual(cnt * 500,variable.cntAndPrice.cnt,'物料数量不对')
          CheckUtil.expectEqual(price ,variable.cntAndPrice.price* 500,`价格不对,期望为${variable.cntAndPrice.price* 500},实际是${price}`)
          for (let row of content) {
            CheckUtil.expectEqualObj(row.purcharse, row.linkInstockCnt)
            CheckUtil.expectEqualObj(row.purcharse, row.sendCnt)
          }
        },
      }),
      new CreateNote3M(),
      new QueryAction({
        name:'查询订单',
        query:{
          status:'normal',
        },
        url:'/app/note/listNote'
      },{
        warehouseType:'supplierWarehouse',
        buildVariable(result){
          let content:any[] = result.result.content;
          return {
            noteId:content[0].noteId
          }
        },
        check(result){
          let content:any[] = result.result.content;
          CheckUtil.expectEqual(content.length,1)
        }
      }),

      new QueryAction({
        name:'查询订单物料',
        query:{
          noteId:'${noteId}',
        },
        url:'/app/noteItem/listNoteItem'
      },{
        warehouseType:'supplierWarehouse',
        buildVariable(result){
          let content:any[] = result.result.content;
          return {
            noteItems:content
          }
        }
      }),
      new Action({
        name:'改价格',
        url:'/app/note/updatePrice',
        param:{
          noteItems:'${noteItems}'
        }
      },{
        warehouseType:'supplierWarehouse',
        parseHttpParam(param) {
          let noteItems = param.noteItems;
          noteItems = NoteItemUtil.change(noteItems);
          for(let item of noteItems){
            item.price = item.price * 2
          }
          param.noteItems = noteItems
          return param;
        },
      }),

      new QueryAction({
        name:'查询订单物料',
        query:{
          noteId:'${noteId}',
        },
        url:'/app/noteItem/listNoteItem'
      },{
        warehouseType:'supplierWarehouse',
        buildVariable(result){
          let content = result.result.content
          return {
            
            cntAndPrices:NoteItemUtil.buildCntAndPrice(content),
            linkNoteItemId:ArrayUtil.toArray(content,'linkNoteItemId')
          }
        }
      }),

      new QueryAction({
        name:'验证价格',
        query:{
          noteItemId:'${linkNoteItemId}',
        },
        url:'/app/noteItem/listNoteItem'
      },{
        check(result){
          NoteItemUtil.checkCntAndPrice(result.content,variable.cntAndPrice,{"羊肉":500})
        }
      }),






    ]
  }
  getName(): string {
    return '订单流程：供应商视角'
  }
}
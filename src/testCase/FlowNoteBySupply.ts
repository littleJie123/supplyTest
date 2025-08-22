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
import ProcessNote from "../action/note/ProcessNote";
interface CheckOpt {
  checkItems?(item: any);
  checkSupplierItems?(item: any);
  targetCol?: string
  feeMap?:any;
}
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
          let content: any[] = result.result.content
          let row = content.find(item => item.name == '羊肉')

          return {
            linkNoteItemId: ArrayUtil.toArray(
              content,
              'linkNoteItemId'
            ),
            cntAndPrice: {
              cnt: new Fraction(row.purcharse.buyUnitFee, 1).cal(row.purcharse.cnt),
              price: new Fraction(1, row.stockBuyUnitFee).cal(row.price)
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
          let row = content.find(item => item.name == '羊肉')
          let cnt = new Fraction(row.purcharse.buyUnitFee, 1).cal(row.purcharse.cnt)
          let price = new Fraction(1, row.stockBuyUnitFee).cal(row.price)
          CheckUtil.expectEqual(cnt * 500, variable.cntAndPrice.cnt, '物料数量不对')
          CheckUtil.expectEqual(price, variable.cntAndPrice.price * 500, `价格不对,期望为${variable.cntAndPrice.price * 500},实际是${price}`)
          for (let row of content) {
            CheckUtil.expectEqualObj(row.purcharse, row.linkInstockCnt)
            CheckUtil.expectEqualObj(row.purcharse, row.sendCnt)
          }
        },
      }),
      new CreateNote3M(),
      new QueryAction({
        name: '查询订单',
        query: {
          status: 'normal',
        },
        url: '/app/note/listNote'
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content: any[] = result.result.content;
          return {
            noteId: content[0].noteId
          }
        },
        check(result) {
          let content: any[] = result.result.content;
          CheckUtil.expectEqual(content.length, 1)
        }
      }),

      new QueryAction({
        name: '查询订单物料',
        query: {
          noteId: '${noteId}',
        },
        url: '/app/noteItem/listNoteItem'
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content: any[] = result.result.content;
          return {
            noteItems: content
          }
        }
      }),
      new Action({
        name: '改价格',
        url: '/app/note/updatePrice',
        param: {
          noteItems: '${noteItems}'
        }
      }, {
        warehouseType: 'supplierWarehouse',
        parseHttpParam(param) {
          let noteItems = param.noteItems;
          noteItems = NoteItemUtil.change(noteItems);
          for (let item of noteItems) {
            item.price = item.price * 2
          }
          param.noteItems = noteItems
          return param;
        },
      }),

      ... this.buildCheckNoteItem(),

      new ProcessNote({
        action: 'accept',
        noteId: '${noteId}',
        noteItems: "${noteItems}"
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
        warehouseType: 'supplierWarehouse'
      }),
      new ProcessNote({
        action: 'send',
        noteId: '${noteId}',
        noteItems: "${noteItems}",
        buildItem(item) {
          item.sendCnt = item.cnt / 2
          return item;
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),
      new QueryAction({
        name: '查询订单[已发送]',
        url: '/app/note/listNote',
        query: {
          status: 'sended'
        },
        checkers: {
          len: 1
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),
      ... this.buildCheckNoteItem('sendCnt', {
        checkItems(item) {
          CheckUtil.expectEqual(item.purcharse.cnt / 2, item.sendCnt.cnt)
        }
      }),
      new ProcessNote({
        action: 'instock',
        noteId: '${noteId}',
        noteItems: "${noteItems}",
        buildItem(item) {
          item.instockCnt = item.cnt / 2
          return item;
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),
      new QueryAction({
        name: '查询订单[已发送]',
        url: '/app/note/listNote',
        query: {
          status: 'sended'
        },
        checkers: {
          len: 0
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),
      ... this.buildCheckNoteItem('instock', {
        checkSupplierItems(item) {
          CheckUtil.expectEqual(item.purcharse.cnt / 2, item.instock.cnt)
        },
        checkItems(item) {
          CheckUtil.expectEqual(item.purcharse.cnt / 2, item.linkInstockCnt.cnt)
        },
        targetCol: 'linkInstockCnt'
      }),

      new CreateNote3M(),
      new SaveMaterial({
        name: '香肉',
        buyUnit: [{ fee: 1, name: "包" }, { isSupplier: true, fee: 10, name: "盒" }],
        remark:'香肉的品相'
      }, {
        warehouseType: 'supplierWarehouse'
      }),

      new QueryAction({
        name: '查询物料',
        url: '/app/material/listMaterial4Supplier',
        query: {
          warehouseId: '${supplierWarehouse.warehouseId}'
        },
        checkers: {
          len: 3
        }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content:any[] = result.result.content;
          let material = content.filter(row=>['羊肉','香肉'].includes(row.name));
          return {
            materialId:ArrayUtil.toArray(material,'materialId'),
            materials: ArrayUtil.toMapByKey(content, 'name')
          }
        },
      }),
      new QueryAction({
        name: '查询物料合并信息',
        url:'/app/materialLink/getCombineInfo',
        query:{
          materialId:"${materialId}"
        }
      },{
        warehouseType:'supplierWarehouse'
      }),
      new Action({
        name: '合并物料',
        url: '/app/materialLink/combineMaterial',
        param: {
          "src": {
            "materialId": "${materials.羊肉.materialId}",
            "cnt": 1,
            "buyUnitFee": -500,
            "stocksUnitId": 18
          },
          "target": {
            "materialId": "${materials.香肉.materialId}",
            "cnt": 1,
            "buyUnitFee": -10,
            "stocksUnitId": 21
          }
         
        }

      }, {
        warehouseType: 'supplierWarehouse'
      }),
      new QueryAction({
        name:'查询订单',
        url:'/app/note/listNote',
        query:{
          status:'normal'
        }
      },{
        warehouseType:'supplierWarehouse',
        buildVariable(result){
          return {
            noteId:result.result.content[0].noteId
          }
        }
      }),

      
      ... this.buildCheckNoteItem(null,{
        feeMap:{'羊肉':10},
        
      }),
      new QueryAction({
        name:'查询订单物料',
        url:'/app/noteItem/listNoteItem',
        query:{
          noteId:'${noteId}'
        },
        
      },{
        warehouseType:'supplierWarehouse',
        buildVariable(result){
           
          return {
            noteItems: result.result.content 
          }
        }
      }),
      new QueryAction({
        name:'验证对方物料品相',
        url:'/app/material/getLinkMaterialInfo',
        query:{
          noteItemId:'${noteItems}'
        }
      },{
        parseHttpParam(param){
          let noteItemId:any[] = param.noteItemId;
          let row = noteItemId.find(item=>item.name=='香肉')
          return {
            noteItemId:row.linkNoteItemId,
            warehouseGroupId:param.warehouseGroupId
          }
        },
        check(result){
          result = result.result;
          CheckUtil.expectEqualObj(result,{
            name:'香肉',
            remark:'香肉的品相'
          })
        }
      }),
      ... this.buildInstockActions(),

      ... this.buildCheckNoteItem('instock',{
        targetCol:'linkInstockCnt',
        feeMap:{
          羊肉:10
        }
      }),


    
    ]
  }

  private buildInstockActions():BaseTest[]{
    return [
      new ProcessNote({
        action: 'accept',
        noteId: '${noteId}',
        noteItems: "${noteItems}"
      }, {
        warehouseType: 'supplierWarehouse'
      }),
      
      new ProcessNote({
        action: 'send',
        noteId: '${noteId}',
        noteItems: "${noteItems}",
        buildItem(item) {
          item.sendCnt = item.cnt / 2
          return item;
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),
      new ProcessNote({
        action: 'instock',
        noteId: '${noteId}',
        noteItems: "${noteItems}",
        buildItem(item) {
          item.instockCnt = item.cnt / 2
          return item;
        }
      }, {
        warehouseType: 'supplierWarehouse'
      })
    ]
  }

  /**
   * 构建检查
   * @param cntCol 
   * @param checkOpt 
   * @returns 
   */
  private buildCheckNoteItem(cntCol?: string, checkOpt?: CheckOpt): BaseTest[] {
    let variable = this.getVariable();
    return [
      new QueryAction({
        name: '查询订单物料',
        query: {
          noteId: '${noteId}',
        },
        url: '/app/noteItem/listNoteItem'
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content:any[] = result.result.content
          return {

            cntAndPrices: NoteItemUtil.buildCntAndPrice(content, cntCol),
            linkNoteItemId: ArrayUtil.toArray(content, 'linkNoteItemId'),
            noteItems: content
          }
        },
        check(result) {
          let content = result.result.content;
          if (checkOpt?.checkSupplierItems) {
            for (let row of content) {
              checkOpt?.checkSupplierItems(row);
            }
          }
        }

        
      }),

      new QueryAction({
        name: '验证价格/数量',
        query: {
          noteItemId: '${linkNoteItemId}',
        },
        url: '/app/noteItem/listNoteItem'
      }, {
        check(result) {
          let content = result.result.content
          NoteItemUtil.checkCntAndPrice(
            content,
            variable.cntAndPrices,
            checkOpt?.feeMap ?? { "羊肉": 500 },
            cntCol,
            checkOpt?.targetCol
          )
          if (checkOpt?.checkItems) {
            for (let item of content) {
              checkOpt?.checkItems(item)
            }
          }
        }
      }),
    ]
  }
  getName(): string {
    return '订单流程：供应商视角'
  }
}
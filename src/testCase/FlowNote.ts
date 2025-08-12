import { BaseTest, TestCase } from "testflow";
import ListMaterial from "../action/material/ListMaterial";
import AddPurcharse from "../action/note/AddPurcharse";
import CreateNote3M from "../action/note/CreateNote3M";
import ListNoteGroup from "../action/note/ListNoteGroup"; 
import UpdatePurchase from "../action/note/UpdatePurchase";
import PreTest from "./PreTest";
import ListNoteItem from "../action/noteItem/ListNoteItem";
import BatchProcessNote from "../action/note/BatchProcessNote";
import ConfirmBill from "../action/bill/ConfirmBill";
import ListNoteFromGroup from "../action/note/ListNoteFromGroup";
import BatchProcessByNoteId from "../action/note/BatchProcessByNoteId";
import CreateBillAllNotes from "../action/bill/CreateBillAllNotes";
import AddMaterial from "../action/material/AddMaterial";
import NeedUpdatePriceNote from "../action/price/NeedUpdatePriceNote";
import NeedUpdateMaterials from "../action/price/NeedUpdateMaterials";
import UpdatePrice4Note from "../action/price/UpdatePrice4Note";
import UpdatePrice4Material from "../action/price/UpdatePrice4Material";
import GetMaterialInfo from "../action/material/GetMaterialInfo";
import ListNoteByQuery from "../action/note/ListNoteByQuery";

/**
 * 订单流程
 */
export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    return [
      new PreTest(),
      new AddMaterial('狗肉',{
        suppliers:[
        {
          "isDef": true,
          "supplierId": "${supplierMap.供应商1}",
          
          "price":10
        }]
      }),
      new ListMaterial(),
      
      //第一页面批量处理

      new CreateNote3M(),
      new ListMaterial({
        hasPurcharse: 0
      }),

      new ListNoteGroup({
        groupType: 'NoteDay',
        len: 1,
        noteCnt:2
      }),
      
      new BatchProcessNote({
        action:'instock'
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status:'instocked',
        len: 1,
        noteCnt:2
      }),
      new BatchProcessNote({
        action:'statement'
      }),
      new ConfirmBill(),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status:'statement',
        len: 1,
        noteCnt:2
      }),

      // 第二界面处理
      new CreateNote3M(),
      new ListNoteGroup({
        groupType: 'NoteDay',
        len: 1,
        noteCnt:2
      }),
      new ListNoteFromGroup({
        notes:[
          {cost:846},
          {cost:500}
        ]
      }),
      new BatchProcessByNoteId({
        index:0
      }),
      new BatchProcessByNoteId({
        index:1
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status:'instocked',
        len: 1,
        noteCnt:2
      }),
      new ListNoteFromGroup({
        notes:[
          {cost:846},
          {cost:500}
        ]
      }),
      new CreateBillAllNotes({
        len:2,
        bills:[
          {instockCost:500},
          {instockCost:846}
        ]
      }),
      new ConfirmBill(),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status:'statement',
        len: 1,
        noteCnt:4
      }),

      // 第三页面处理
      new CreateNote3M(),
      new CreateNote3M({
        noBuildSupplier:true,
        items:[
          {
            "materialId": '${materialMap.猪肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 400,
            "buyUnitFee": 1,
            "stockUnitsId": 5,
            "price": 21,
            "stockBuyUnitFee": -10
          },
          {
            "materialId": '${materialMap.羊肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 30,
            "buyUnitFee": 500,
            "stockUnitsId": 29,
            "price": 0.2,
            "stockBuyUnitFee": 500
          },
          {
            "materialId": '${materialMap.狗肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 30,
            "buyUnitFee": 1,
            "stockUnitsId": 18,
            "price": 10,
            "stockBuyUnitFee": 1
          }
        ],
        checkNotes:[
          {
            materialCnt:3,
            cost:1146
          }
        ]
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        len: 1,
        noteCnt:3
      }),
      new ListNoteItem({
        supplierName:'供应商1'
      }),
      new NeedUpdatePriceNote({}),
      new UpdatePrice4Note(),

      new NeedUpdateMaterials({}),
      new UpdatePrice4Material(),

      new GetMaterialInfo({
        price:20
      }),
      new ListNoteByQuery({
        query:{
          status:'normal',
        },
        checkNotes:[
          {cost:1106},
          {cost:500},
          {cost:806}
        ]
      })
      
      
      
    ]
  }
  getName(): string {
    return '订单流程'
  }


}
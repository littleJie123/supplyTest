import { BaseTest, TestCase } from "testflow";
import PreTest from "./PreTest";
import AddPurcharse from "../action/note/AddPurcharse";
import ListMaterial from "../action/material/ListMaterial";
import CreateNote3M from "../action/note/CreateNote3M";
import ListNoteItem from "../action/noteItem/ListNoteItem";
import ListNoteGroup from "../action/note/ListNoteGroup";
import UpdatePurchase from "../action/note/UpdatePurchase";


export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    return [
      new PreTest(),
      new ListMaterial(),
      new AddPurcharse({
        name: '羊肉',
        stock: {
          "cnt": 30,
          "buyUnitFee": 500,
          "stockUnitsId": 29
        }
      }),
      new AddPurcharse({
        name: '猪肉',
        stock: {
          cnt: 400, 
          buyUnitFee: 1, 
          stockUnitsId: 18
        }
      }),
      new AddPurcharse({
        name: '牛肉',
        stock:  {cnt: 50, buyUnitFee: 1, stockUnitsId: 18}
      }),
      new ListMaterial({
        hasPurcharse:3
      }),
      new CreateNote3M(),
      new ListMaterial({
        hasPurcharse:0
      }),
      new ListNoteItem({
        supplierName:'供应商1',
        len:2
      }),
      new UpdatePurchase(),
      new ListNoteItem({
        supplierName:'供应商2',
        len:1
      }),
      new ListNoteGroup({
        groupType:'NoteDay',
        len:1
      }),
      new ListNoteGroup({
        groupType:'SupplierList4Note',
        len:2
      }),
      new ListNoteGroup({
        groupType:'Material4NoteList',
        len:3
      })

    ]
  }
  getName(): string {
    return '订单逻辑链路'
  }

}
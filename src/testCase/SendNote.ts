import { TestCase,ITest, BaseTest } from "testflow"; 
import TestReg from "./TestReg";
import ListMaterial from "../action/material/ListMaterial";
import CreateNote from "../action/note/CreateNote";
import ListNote from "../action/note/ListNote";
import ListNoteItem from "../action/note/ListNoteItem";
import Instock from "../action/note/Instock";

export default class extends TestCase {
  buildActions(): BaseTest[] {
    return [
      new TestReg(),
      new ListMaterial(),
      new CreateNote(),
      new ListNote(),
      new ListNoteItem(),
      new Instock()
    ];
  }
  getName(): string {
    return "确认订单"
  }
  
}
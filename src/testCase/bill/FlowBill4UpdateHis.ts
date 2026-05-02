import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import PreNote from "../PreNote";
import BuildInventory from "../../action/case/BuildInventory";
export default class extends TestCase {
  beginMaterial: number;
  getName(): string {
    return '对账单用[测试修改记录]'
  }





  /**
   * 
   * @returns 
   */
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [
      new PreTest()

    ]


    ret.push(new PreNote({
      cnt: 10,
      price: 20,
      names: ['白菜', '猪肉'],
      needInstock: true
    }))


    ret.push(new PreNote({
      cnt: 10,
      price: 20,
      names: ['羊肉', '猪肉', '牛肉'],
      needInstock: true
    }))



    ret.push(new Action({
      url: '/app/note/schNote4Bill',
      name: '查询订单',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      buildVariable(result) {
        let content = result.result.content;
        return {
          noteIds: ArrayUtil.toArray(content, 'noteId'),
          noteId: content[0].noteId
        }
      }
    }))

    ret.push(new Action({
      url: '/app/bill/createBill',
      name: '生成对账单',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        noteIds: '${noteIds}'

      }
    }, {
      check(result) {
        result = result.result
        CheckUtil.expectEqualObj(result, {
          "noteCnt": 2,
          "itemCnt": 5,
          "instockCost": 1000,
          "statementCost": 1000
        })
      },
      buildVariable(result) {
        let bill = result.result;
        return {
          billId: bill.billId
        }
      }
    }))

    ret.push(new Action({
      url: '/app/noteItem/listNoteItem',
      name: '查询订单物料',
      param: {
        noteId: '${noteIds}'
      }
    }, {

      buildVariable(result) {
        let content = result.result.content
        return {
          noteItemId: content[0].noteItemId
        }
      }
    }))

    ret.push(new Action({
      url: '/app/bill/updateNoteItem4Bill',
      name: '修改对账单物料',
      param: {
        noteItemId: '${noteItemId}',
        statementCnt: {
          cnt: 5,
          buyUnitFee: -10

        },
        price: {
          price: 20,
          buyUnitFee: 10
        },
        remark: '修改了'
      }
    }));

    ret.push(new Action({
      url: '/app/bill/updateNoteItem4Bill',
      name: '修改对账单物料',
      param: {
        noteItemId: '${noteItemId}',
        statementCnt: {
          cnt: 2,
          buyUnitFee: -10

        },
        price: {
          price: 20,
          buyUnitFee: 1
        },
        remark: '修改了'
      }
    }));


    ret.push(new Action({
      url: '/app/bill/updateBill',
      name: '修改订单',
      param: {
        billId: '${billId}',
        payCost: 100,
        payFee: 0.8,
        already: false,
        remark: '12312312'
      }
    }, {

      check(result) {

      }
    }))



    ret.push(new Action({
      url: '/app/bill/listNoteItem4Bill',
      name: '查询订单详情',
      param: {
        billId: '${billId}'
      }
    }, {


    }))















    return ret;
  }












}
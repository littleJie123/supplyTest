import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import PreNote from "../PreNote";
import BuildInventory from "../../action/case/BuildInventory";
export default class extends TestCase {
  beginMaterial: number;
  getName(): string {
    return '对账单用'
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

    ret.push(new PreNote({
      cnt: 10,
      price: 30,
      names: ['鸡蛋'],
      needStatement: true
    }))


    ret.push(new Action({
      url: '/app/note/schNote4Bill',
      name: '查询订单',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      buildVariable(result) {
        let conent = result.result.content;
        return {
          noteIds: ArrayUtil.toArray(conent, 'noteId')
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
      url: '/app/bill/removeNote',
      name: '移除订单',
      param: {
        billId: '${billId}'
      }
    }, {
      parseHttpParam(param, varibale) {
        param.noteId = varibale.noteIds[0];
        return param
      },
      check(result) {

      }
    }))

    ret.push(new Action({
      url: '/app/bill/listUpdateHis4bill',
      name: '查询日志',
      param: {
        billId: '${billId}'
      }
    }, {

      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqual(content.length, 1);
      }
    }))

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
      url: '/app/bill/setBillStatus',
      name: '设置状态',
      param: {
        billId: '${billId}',
        status: 'confirm'
      }
    }, {

      check(result) {
      }
    }))



    return ret;
  }












}
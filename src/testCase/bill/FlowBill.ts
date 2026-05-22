import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import PreNote from "../PreNote";
import BuildInventory from "../../action/case/BuildInventory";
import Instock from "../../action/note/Instock";
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
      needInstock: true,
      needNoteItems: true
    }))

    ret.push(... this.buildBack({
      cnt: 5
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
      },
      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqual(content.length, 3)
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
          "noteCnt": 3,
          "itemCnt": 8,
          "instockCost": 1000 - 5 * 20 * 3,
          "statementCost": 1000 - 5 * 20 * 3
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
        billId: '${billId}',
        remark: '不想要了'
      }
    }, {
      parseHttpParam(param, varibale) {
        param.noteId = varibale.noteId;
        return param
      },
      check(result) {

      }
    }))

    ret.push(new Action({
      url: '/app/note/listNote',
      name: '验证移除',
      param: {
        billId:'${billId}'
      }
    }, {

      check(result) {
        let content: any[] = result.result.content;
        content = content.filter(row => row.billId != 0)
        CheckUtil.expectEqual(content.length, 2);
      },
      buildVariable(result){
        let content: any[] = result.result.content;
        let back = content.find(row=>row.type=='back');
        let thePurcharse = content.find(row=>row.type!='back');
        return {
          backId:back.noteId,
          theNoteId:thePurcharse.noteId
        }
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
      name: '修改对账单',
      param: {
        billId: '${billId}',
        payCost: 100,
        payFee: 0.8,
        already: true,
        remark: '12312312'
      }
    }, {

      check(result) {

      }
    }))

    ret.push(new Action({
      url: '/app/bill/listBill',
      name: '验证修改',
      param: {
      }
    }, {

      check(result) {
        let bill = result.result.content[0]
        CheckUtil.expectEqualObj(
          bill,{
            payCost: 100,
            payFee: 0.8,
            already: 1,
          }
        )
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

    ret.push(new Action({
      url: '/app/note/listNote',
      name: '验证设置状态',
      param: {
        billId: '${billId}'
      }
    }, {

      buildVariable(result) {
        let conent = result.result.content;
        return {
          noteIds: ArrayUtil.toArray(conent, 'noteId')
        }
      },
      check(result){
        let content:any[] = result.result.content;
        content = content.filter(row=>row.status != 'statement')
        CheckUtil.expectEqual(content.length,0);
      }
    }))

    ret.push(new Action({
      url: '/app/noteItem/listNoteItem',
      name: '查询订单物料',
      param: {
        noteId: '${theNoteId}'
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
        billId:'${billId}',
        noteItemId: '${noteItemId}',
        statementCnt: {
          cnt: 8,
          buyUnitFee: 1

        },
        price: {
          price: 15,
          buyUnitFee: 1
        },
        remark: '修改了'
      }
    }));

    ret.push(new Action({
      url: '/app/bill/listBill',
      name: '验证修改物料',
      param: {
         
      }
    },{
      check(result){
        let content = result.result.content;
        CheckUtil.expectEqualObj(content[0],{
          statementCost:220.00,
          instockCost:250
        })
      }
    }));

    ret.push(new Action({
      url: '/app/noteItem/listNoteItem',
      name: '查询退货单物料',
      param: {
        noteId: '${backId}'
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
      name: '修改退货单物料',
      param: {
        billId:'${billId}',
        noteItemId: '${noteItemId}',
        statementCnt: {
          cnt: 4,
          buyUnitFee: 1

        },
        price: {
          price: 15,
          buyUnitFee: 1
        },
        remark: '修改了'
      }
    }));

    ret.push(new Action({
      url: '/app/bill/listBill',
      name: '验证退货单修改',
      param: {
      }
    }, {

      check(result) {
        let bill = result.result.content[0]
        CheckUtil.expectEqualObj(
          bill,{
            instockCost:550-275,
            statementCost:520-260
          }
        )
      }
    }))

    ret.push(new Action({
      url:'/app/note/listNote',
      name:'查询不在bill的订单',
      param:{
        billId:0
      }
    },{
      buildVariable(result){
        let content = result.result.content;
        return {
          nodeId:content[0].nodeId
        }
      }
    }))

    ret.push(new Action({
      url: '/app/bill/addNote2Bill',
      name: '增加订单到对账单',
      param: {
        billId: '${billId}',
        noteId:'${noteId}'
      }
    } ));







    ret.push(new Action({
      url: '/app/bill/removeBill',
      name: '删除对账单',
      param: {
        billId: '${billId}'
      }
    }, {
      parseHttpParam(param, varibale) {
        param.noteId = varibale.noteId;
        return param
      }
    }));

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
      name: '重新生成对账单',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        noteIds: '${noteIds}'

      }
    }, {

      buildVariable(result) {
        let bill = result.result;
        return {
          billId: bill.billId
        }
      }
    }))

    ret.push(new Action({
      url: '/app/note/listNote',
      name: '查询订单',
      param: {
        billId: '${billId}'
      }
    }, {
      parseHttpParam(param, varibale) {
        param.noteId = varibale.noteId;
        return param
      }
    }));

    ret.push(new Action({
      url: '/app/bill/SetNoteStatusInBill',
      name: '设置订单状态',
      param: {
        billId: '${billId}',
        status: 'statement'
      }
    }, {
      parseHttpParam(param, varibale) {
        param.noteId = varibale.noteIds[0];
        return param
      }
    }));

    ret.push(new Action({
      url: '/app/bill/SetNoteStatusInBill',
      name: '设置订单状态1',
      param: {
        billId: '${billId}',
        status: 'statement'
      }
    }, {
      parseHttpParam(param, varibale) {
        param.noteId = varibale.noteIds[1];
        return param
      }
    }));



    return ret;
  }






  private buildBack(opt?: { cnt?: number }): BaseTest[] {

    let ret: BaseTest[] = [];
    let variable = this.getVariable()
    ret.push(new Action({
      name: '退货',
      url: '/app/noteBack/createNoteBack',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      parseHttpParam(param) {
        let noteItems: any[] = variable.noteItems;
        param.items = noteItems.map(row => ({

          "cnt": opt?.cnt ?? 100,
          "buyUnitFee": row.buyUnitFee,
          "price": row.price,
          "noteItemId": row.noteItemId,
          "supplierId": row.supplierId,
          "materialId": row.materialId,
          "stockBuyUnitFee": row.stockBuyUnitFee,
          "stockUnitsId": row.stockUnitsId
        }))
        return param;
      },
    }))

    return ret;
  }





}
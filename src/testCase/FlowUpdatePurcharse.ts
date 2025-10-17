import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreCreateNoteAndLink from "./PreCreateNoteAndLink";
import PreTest from "./PreTest";
import QueryAction from "../action/QueryAction";
import Action from "../action/Action";
import CheckerMaterialLink from "../action/CheckerMaterialLink";

export default class extends TestCase {
  getName(): string {
    return '主动发货+修改订单';
  }

  protected buildActions(): BaseTest[] {
    let variable = this.getVariable()
    return [
      new PreTest,
      new PreCreateNoteAndLink(),

      new Action({
        name: '新增物料[鸡肉]',
        param: {
          "img": [],
          "buyUnit": [
            {
              "isSupplier": true,
              "name": "斤",
              "fee": 1
            }
          ],
          "name": "鸡肉",

          "warehouseId": '${supplierWarehouse.warehouseId}'
        },
        url:'/app/material/SaveMaterial'
      },{
        warehouseType:'supplierWarehouse'
      }),
      new QueryAction({
        name: '查询物料',
        url: '/app/material/listMaterial4Supplier',
        query: {
          "warehouseId": '${supplierWarehouse.warehouseId}'
        }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content = result.result.content;
          return {
            materials: ArrayUtil.toMapByKey(content, 'name', 'materialId')
          }
        },
      }),
      new QueryAction({
        name: '查询餐厅',
        url: '/app/supplier/listSupplier'
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content = result.result.content;
          return {
            suppliers: ArrayUtil.toMapByKey(content, 'name', 'supplierId')
          }
        }
      }),
      new Action({
        url: '/app/note/createNote',
        name: '创建订单',
        param: {
          "items": [
            {
              "stockBuyUnitFee": -500,
              "price": 10,
              "materialId": '${materials.羊肉}',
              "cnt": 5000,
              "buyUnitFee": 1,
              "supplierId": '${suppliers.新餐厅}',
              "stockUnitsId": 0
            },
            {
              "stockBuyUnitFee": -10,
              "price": 20,
              "materialId": '${materials.猪肉}',
              "cnt": 200,
              "buyUnitFee": 1,
              "supplierId": '${suppliers.新餐厅}',
              "stockUnitsId": 0
            }

          ],
          "warehouseId": '${supplierWarehouse.warehouseId}'
        }
      }, {
        warehouseType:'supplierWarehouse',
        buildVariable(result) {
          result = result.result[0];

          return {
            noteId: result.noteId,
            cost:result.cost
          }
        }
      }),
      new QueryAction({
        name: '查询订单',
        url: '/app/note/listNote',
        query: {
          noteId: '${noteId}'
        },

      },{
        warehouseType:'supplierWarehouse',
        buildVariable(result){
          return {
            linkNoteId:result.result.content[0].linkNoteId
          }
        }
      }),
      new QueryAction({
        name: '查询订单物料',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${noteId}'
        },

      }, {
        warehouseType:'supplierWarehouse',
        check(result) {
          let content = result.result.content;

          CheckUtil.expectEqual(content.length, 2);
        },
        buildVariable(result) {
          let content = result.result.content;
          return {
            noteItemMap: ArrayUtil.toMapByKey(content, 'name')
          }
        }

      }),
      new Action({
        url:'/app/noteItem/updatePurcharse',
        name:'更改数据',
        param:{
          noteId:'${noteId}',
          noteItems:[
            
            {
              noteItemId:'${noteItemMap.猪肉.noteItemId}',
              "stockBuyUnitFee": -10,
              "price": 10,
              "materialId": '${materials.猪肉}',
              "cnt": 150,
              "buyUnitFee": 1,
              "stockUnitsId": 0
            },
            {
              "cnt": 30,
              "buyUnitFee": 1,
              "price": 30,
              "stockBuyUnitFee": 1,
              "materialId": '${materials.鸡肉}'
            }
          ]
        }
      },{
        warehouseType:'supplierWarehouse',
        check(result){
          CheckUtil.expectEqual(result.result.cost ,1050)
        }
      }),
      new Action({
        name:'发送订单',
        url:'/app/note/sendNote',
        param:{
          noteIds:'${noteId}'
        }
      },{
        warehouseType:'supplierWarehouse',
        parseHttpParam(param) {
          param.noteIds = [param.noteIds]
          return param;
        },
      }),
      new CheckerMaterialLink(),
      new QueryAction({
        name: '查询餐厅订单物料',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${linkNoteId}'
        },
        checkers:{
          checkArray:[
            {name:'猪肉'},
            {name:'鸡肉'}
          ]
        }

      }, {
        check(result) {
          let content = result.result.content;

          CheckUtil.expectEqual(content.length, 2);
         
        }

      }),
      new QueryAction({
        name: '查询餐厅订单',
        url: '/app/note/listNote',
        query: {
          noteId: '${linkNoteId}'
        }

      }, {
        check(result) {
          let content = result.result.content;

          CheckUtil.expectEqual(content[0].cost, 1050);
         
        }

      })
    ]
  }
}
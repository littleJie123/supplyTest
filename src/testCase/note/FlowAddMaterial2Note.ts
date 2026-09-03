import { BaseTest, TestCase } from 'testflow';
import AddMaterial2Note from '../../action/note/AddMaterial2Note';
import BatchProcessNote from '../../action/note/BatchProcessNote';
import CreateNote3M from '../../action/note/CreateNote3M';
import ListNoteGroup from '../../action/note/ListNoteGroup';
import QueryAction from '../../action/QueryAction';
import PreTest from '../PreTest';

/**
 * 验证已入库订单不允许新增物料。
 */
export default class extends TestCase {
  getName(): string {
    return '订单新增物料';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest(),
      new CreateNote3M({
        items: [
          {
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商2}',
            cnt: 50,
            buyUnitFee: 1,
            stockUnitsId: 18,
            price: 10,
            stockBuyUnitFee: 1
          },
          {
            materialId: '${materialMap.羊肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 30,
            buyUnitFee: 500,
            stockUnitsId: 29,
            price: 0.2,
            stockBuyUnitFee: 500
          }
        ],
        checkNotes: [{ materialCnt: 1, cost: 6 }, { materialCnt: 1, cost: 500 }]
      }),
      new QueryAction({
        name: '记录已入库订单',
        url: '/app/note/listNote',
        query: { noteId: '${noteMap.供应商1}' }
      }, {
        buildVariable(result) {
          const row = result.result.content.find(item => item.supplierName === '供应商1');
          return { instockedNoteId: row.noteId };
        }
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        len: 1,
        noteCnt: 2
      }),
      new BatchProcessNote({ action: 'instock' }),
      new AddMaterial2Note({
        noteId: '${instockedNoteId}',
        materialId: '${materialMap.猪肉.materialId}',
        name: '已入库订单新增猪肉失败',
        remark: '已入库订单不允许新增猪肉',
        expectedStatus: 500,
        expectedMessage: '订单状态不支持新增物料'
      }),

      new CreateNote3M(),
      new QueryAction({
        name: '记录已有猪肉订单',
        url: '/app/note/listNote',
        query: { noteId: '${noteMap.供应商1}' }
      }, {
        buildVariable(result) {
          const row = result.result.content.find(item => item.supplierName === '供应商1');
          return { existingMaterialNoteId: row.noteId };
        }
      }),
      new AddMaterial2Note({
        noteId: '${existingMaterialNoteId}',
        materialId: '${materialMap.猪肉.materialId}',
        name: '订单新增已有猪肉失败',
        remark: '订单中已存在猪肉，不允许重复新增',
        expectedStatus: 500,
        expectedMessage: '物料已存在'
      }),

      new CreateNote3M({
        items: [
          {
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商2}',
            cnt: 50,
            buyUnitFee: 1,
            stockUnitsId: 18,
            price: 10,
            stockBuyUnitFee: 1
          },
          {
            materialId: '${materialMap.羊肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 30,
            buyUnitFee: 500,
            stockUnitsId: 29,
            price: 0.2,
            stockBuyUnitFee: 500
          }
        ],
        checkNotes: [{ materialCnt: 1, cost: 6 }, { materialCnt: 1, cost: 500 }]
      }),
      new QueryAction({
        name: '记录无猪肉订单',
        url: '/app/note/listNote',
        query: { noteId: '${noteMap.供应商1}' }
      }, {
        buildVariable(result) {
          const row = result.result.content.find(item => item.supplierName === '供应商1');
          return { newMaterialNoteId: row.noteId };
        }
      }),
      new AddMaterial2Note({
        noteId: '${newMaterialNoteId}',
        materialId: '${materialMap.猪肉.materialId}',
        name: '正常订单新增猪肉成功',
        remark: '正常订单新增不存在的猪肉',
        cnt: 400,
        price: 21,
        buyUnitFee: 1,
        stockBuyUnitFee: -10,
        expectedResult: {
          materialId: '${materialMap.猪肉.materialId}',
          purcharse: {
            cnt: 400,
            buyUnitFee: 1
          },
          supplierMaterial: {
            buyUnitFee: -10,
            price: 21
          }
        }
      }),
      new QueryAction({
        name: '验证新增物料后的订单汇总',
        url: '/app/note/listNote',
        query: {
          noteId: '${newMaterialNoteId}'
        },
        checkers: {
          checkArray: [{
            cost: 846,
            materialCnt: 2
          }]
        }
      }),
      new QueryAction({
        name: '验证新增后的订单明细',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${newMaterialNoteId}'
        },
        checkers: {
          len: 2,
          checkArray: [{
            materialId: '${materialMap.猪肉.materialId}',
            purcharse: {
              cnt: 400,
              buyUnitFee: 1
            },
            supplierMaterial: {
              price: 21
            }
          }]
        }
      })
    ];
  }
}

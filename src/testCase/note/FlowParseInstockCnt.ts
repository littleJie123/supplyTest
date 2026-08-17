import { BaseTest, CheckUtil, HttpAction, TestCase } from "testflow";
import PreTest from "../PreTest";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import BatchProcessNote from "../../action/note/BatchProcessNote";
import QueryAction from "../../action/QueryAction";
import UpdateCntAndPrice from "../../action/note/UpdateCntAndPrice";
import Recal from "../../action/Recal";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";
import Action from "../../action/Action";

/**
 * 验证 updatePrice → parseInstockCnt：
 * 不传 buyUnitFee 时，instockCnt 按 noteItem.stockUnitsId（箱）理解，换算成 buyUnitFee（瓶）入库。
 *
 * 牛肉：1 箱 = 5 瓶；下单 stockUnitsId=箱；改量为 5 箱 → 库表应为 25 瓶。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: 'parseInstockCnt：牛肉按箱改量，换算为瓶后落库' });
  }

  getName(): string {
    return '改量按采购单位换算';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest().setRemark('初始化餐厅、供应商、物料'),

      new HttpAction({
        name: 'query查箱瓶单位',
        url: '/free/query',
        method: 'POST',
        param: {
          array: [{
            table: 'units',
            query: {
              name: ['箱', '瓶'],
              isDel: 0
            }
          }]
        }
      }, {
        buildVariable(result) {
          const list = result.result?.units ?? [];
          const box = list.find((row: any) => row.name === '箱');
          const bottle = list.find((row: any) => row.name === '瓶');
          if (box?.unitsId == null) {
            throw new Error(`units 未查到箱: ${JSON.stringify(list)}`);
          }
          if (bottle?.unitsId == null) {
            throw new Error(`units 未查到瓶: ${JSON.stringify(list)}`);
          }
          return {
            boxUnitsId: box.unitsId,
            bottleUnitsId: bottle.unitsId
          };
        }
      }).setRemark("free/query units（name in 箱/瓶，不带仓库字段）"),

      new Action({
        name: '牛肉规格改为瓶箱',
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${materialMap.牛肉.materialId}',
          name: '牛肉',
          category: { categoryId: '${categoryMap.肉类}' },
          buyUnit: [
            { name: '瓶' },
            { name: '箱', isSupplier: true, fee: 5 }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商2}',
            price: 10
          }],
          img: [],
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }).setRemark('牛肉：1箱=5瓶，采购单位箱'),

      new Action({
        name: '下单牛肉',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商2}',
            cnt: 10,
            buyUnitFee: 1,
            stockUnitsId: '${boxUnitsId}',
            price: 10,
            stockBuyUnitFee: -5
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : [];
          return {
            noteId: notes[0]?.noteId,
            noteIds: notes.map((row: any) => row.noteId)
          };
        }
      }).setRemark('牛肉下单10瓶，stockUnitsId=箱'),

      new Action({
        name: '发单',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }).setRemark('发单'),

      new ListNoteGroup({
        groupType: 'NoteDay',
        len: 1,
        noteCnt: 1
      }).setRemark('待入库分组'),

      new BatchProcessNote({
        action: 'instock'
      }).setRemark('整单入库'),

      new QueryAction({
        name: '查询入库后订单物料',
        url: '/app/noteItem/listNoteItem',
        query: { noteId: '${noteId}' }
      }, {
        buildVariable(result) {
          return { noteItems: result.result.content };
        },
        check(result) {
          const beef = result.result.content.find((row: any) => row.name === '牛肉');
          CheckUtil.expectEqual(beef != null, true, '未找到牛肉');
        }
      }).setRemark('记下 noteItems，供 updatePrice 使用'),

      new UpdateCntAndPrice({
        name: '按箱改牛肉入库量为5箱',
        changes: [{
          name: '牛肉',
          price: 10,
          stockBuyUnitFee: -5,
          instockCnt: 5
        }],
        highlight: true
      }).setRemark('不传 buyUnitFee；instockCnt=5 箱 → 应换算为 25 瓶'),

      new CheckArray([{
        table: 'noteItem',
        query: {
          noteId: '${noteId}',
          materialId: '${materialMap.牛肉.materialId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '牛肉 noteItem 应有1行');
          CheckUtil.expectEqual(array[0].instockCnt, 25, '库表 instockCnt 应为25瓶');
          CheckUtil.expectEqual(array[0].buyUnitFee, 1, '库表 buyUnitFee 应为1(瓶)');
        }
      }]).setRemark('free/query 校验库表：5箱 → 25瓶'),

      new Recal().setRemark('重算库存'),
      new CheckStock({
        array: [
          { materialId: '${materialMap.牛肉.materialId}', cnt: 25, buyUnitFee: 1 }
        ]
      }).setRemark('库存牛肉25瓶')
    ];
  }
}

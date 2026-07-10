import { BaseTest, DateUtil, TestCase } from "testflow";
import Action from "../../action/Action";
import CreateNote3M from "../../action/note/CreateNote3M";
import CheckNoteLinkCreateTime from "../../action/note/CheckNoteLinkCreateTime";
import ProcessNote from "../../action/note/ProcessNote";
import QueryAction from "../../action/QueryAction";
import SaveShareData from "../../action/shareData/SaveShareData";
import AddMaterial from "../../action/material/AddMaterial";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import ChangeWarehouse2Supplier from "../../action/user/ChangeWarehouse2Supplier";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import ListMaterial from "../../action/material/ListMaterial";
import SaveMaterial from "../../action/material/SaveMaterial";
import SplitNote from "../../action/note/SplitNote";
import PreTest from "../PreTest";

/**
 * 订单 createTime 与链接单 createTime 场景测试
 */
export default class extends TestCase {
  getName(): string {
    return '订单createTime场景';
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    const changedDay = DateUtil.format(DateUtil.beforeDay(new Date(), 3));
    const changedTime = changedDay + ' 12:00:00';

    return [
      new PreTest(),
      new AddMaterial('狗肉', {
        suppliers: [{
          isDef: true,
          supplierId: '${supplierMap.供应商1}',
          price: 10
        }]
      }),
      new ListMaterial(),
      new AddWarehouse({
        name: '新供应商',
        variableType: 'supplierWarehouse',
        type: 'supplier'
      }),
      new SaveMaterial({
        name: '羊肉',
        buyUnit: [
          { name: '克', fee: 1 },
          { isSupplier: true, name: '瓶', fee: 500 }
        ]
      }, {
        warehouseType: 'supplierWarehouse'
      }),

      // 1. 餐厅下单
      new CreateNote3M(),
      new QueryAction({
        name: '记录第一单',
        url: '/app/note/listNote',
        query: { status: 'normal' }
      }, {
        buildVariable(result) {
          const content: any[] = result.result.content;
          const row = content.find(item => item.supplierName === '供应商1');
          return {
            firstNoteId: row.noteId
          };
        }
      }),

      // 2. 供应商接单
      ...this.buildSupplierLink('${firstNoteId}'),

      // 3. 判断原订单和链接单 createTime
      new CheckNoteLinkCreateTime({
        noteId: '${firstNoteId}',
        name: '检查第一单及链接单createTime'
      }),

      // 切回餐厅账号
      new ChangeWarehouse(),

      // 4. 餐厅下单
      new CreateNote3M(),
      new QueryAction({
        name: '记录第二单',
        url: '/app/note/listNote',
        query: { status: 'normal' }
      }, {
        buildVariable(result) {
          const content: any[] = result.result.content;
          const row = content.find(item =>
            item.supplierName === '供应商1' && item.noteId !== variable.firstNoteId
          );
          return {
            secondNoteId: row.noteId
          };
        }
      }),

      // 5. 检查第二单及自动生成的链接单 createTime（供应商已关联，无需再次接单）
      new CheckNoteLinkCreateTime({
        noteId: '${secondNoteId}',
        name: '检查第二单及链接单createTime'
      }),

      // 6. 餐厅入库（第二单）
      new QueryAction({
        name: '查询第二单物料',
        url: '/app/noteItem/listNoteItem',
        query: { noteId: '${secondNoteId}' }
      }, {
        buildVariable(result) {
          return {
            secondNoteItems: result.result.content
          };
        }
      }),
      new ProcessNote({
        action: 'instock',
        noteId: '${secondNoteId}',
        noteItems: '${secondNoteItems}'
      }),

      // 7. 餐厅退货
      new Action({
        name: '退货',
        url: '/app/noteBack/createNoteBack',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        parseHttpParam(param, vars) {
          param.items = vars.secondNoteItems.map(row => ({
            cnt: 10,
            buyUnitFee: row.purcharse?.buyUnitFee ?? row.buyUnitFee,
            price: row.price,
            noteItemId: row.noteItemId,
            supplierId: row.supplierId,
            materialId: row.materialId,
            stockBuyUnitFee: row.stockBuyUnitFee,
            stockUnitsId: row.stockUnitsId
          }));
          return param;
        }
      }),

      // 8. 判断退货单和链接单 createTime
      new CheckNoteLinkCreateTime({
        name: '检查退货单及链接单createTime',
        query: {
          status: 'instocked',
          type: 'back'
        },
        pickNote(content) {
          return content.find(item => item.parenNoteId === variable.secondNoteId);
        },
        saveNoteIdAs: 'backNoteId',
      }),

      // 9. 更改入库单和退货单时间
      new Action({
        name: '更改入库单时间',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${secondNoteId}',
          sysAddTime: changedTime,
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),
      new Action({
        name: '更改退货单时间',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${backNoteId}',
          sysAddTime: changedTime,
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),

      // 10. 判断单据及链接单 createTime 是否同时被修改
      new CheckNoteLinkCreateTime({
        noteId: '${secondNoteId}',
        expectDay: changedDay,
        name: '检查改期后入库单及链接单createTime'
      }),
      new CheckNoteLinkCreateTime({
        noteId: '${backNoteId}',
        expectDay: changedDay,
        name: '检查改期后退货单及链接单createTime'
      }),

      // 11. 餐厅拆单（第一单）
      new QueryAction({
        name: '查询第一单物料',
        url: '/app/noteItem/listNoteItem',
        query: { noteId: '${firstNoteId}' }
      }, {
        buildVariable(result) {
          const content: any[] = result.result.content;
          return {
            noteItemId: content[0].noteItemId
          };
        }
      }),
      new SplitNote({
        noteId: '${firstNoteId}'
      }),
      new QueryAction({
        name: '查询拆分子单',
        url: '/app/note/listNote',
        query: {
          status: 'normal'
        }
      }, {
        buildVariable(result) {
          const content: any[] = result.result.content;
          const row = content.find(item => item.parenNoteId === variable.firstNoteId);
          return {
            splitNoteId: row.noteId
          };
        }
      }),
      new CheckNoteLinkCreateTime({
        noteId: '${splitNoteId}',
        name: '检查拆单及链接单createTime'
      }),
    ];
  }

  private buildSupplierLink(noteId: string): BaseTest[] {
    return [
      new SaveShareData({
        data: { noteId }
      }),
      new Action({
        url: '/share/shareNote',
        name: '查询分享单',
        param: {
          shareDataNo: '${shareDataNo}',
          usersId: '${usersId}',
        }
      }),
      new ChangeWarehouse2Supplier(),
      new Action({
        url: '/app/note/linkNote',
        name: '供应商接单',
        param: {
          warehouseId: '${supplierWarehouse.warehouseId}',
          _shareDataNo: '${shareDataNo}',
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),
    ];
  }
}

import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import CreateNote3M from "../../action/note/CreateNote3M";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import BatchProcessNote from "../../action/note/BatchProcessNote";
import QueryAction from "../../action/QueryAction";
import UpdateCntAndPrice from "../../action/note/UpdateCntAndPrice";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import SaveMaterial from "../../action/material/SaveMaterial";
import SaveShareData from "../../action/shareData/SaveShareData";
import Action from "../../action/Action";
import ChangeWarehouse2Supplier from "../../action/user/ChangeWarehouse2Supplier";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import Recal from "../../action/Recal";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";
import LinkNoteItemUtil from "../../util/LinkNoteItemUtil";
import StockUtil from "../../util/StockUtil";

interface StockExpect {
  name: string;
  cnt: number;
  buyUnitFee?: number;
  cost: number;
}

/** 餐厅视角：本方入库数量/金额 */
interface StoreItemExpect {
  name: string;
  price: number;
  instockCnt: number;
  instockCost: number;
}

interface VerifyOpt {
  name: string;
  noteInstockCost: number;
  storeItems: StoreItemExpect[];
  stocks: StockExpect[];
}

/**
 * 测试入库后通过 updatePrice 接口修改价格、或同时修改价格与入库数量。
 * 餐厅视角验 instockCnt/instockCost；供应商视角经 parseCnt/parsePriceFee 换算后验 link 字段。
 */
export default class extends TestCase {
  getName(): string {
    return '入库后改价改量';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest(),
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
      new CreateNote3M(),
      new QueryAction({
        name: '记录餐厅订单',
        url: '/app/note/listNote',
        query: { status: 'normal' }
      }, {
        buildVariable(result) {
          const content: any[] = result.result.content;
          const row = content.find(item => item.supplierName === '供应商1');
          return {
            noteId: row.noteId
          };
        }
      }),
      ...this.buildSupplierLink('${noteId}'),
      new ChangeWarehouse(),
      new ListNoteGroup({
        groupType: 'NoteDay',
        len: 1,
        noteCnt: 2
      }),
      new BatchProcessNote({
        action: 'instock'
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'instocked',
        len: 1,
        noteCnt: 2
      }),
      new QueryAction({
        name: '记录链接单',
        url: '/app/note/listNote',
        query: {
          noteId: '${noteId}'
        }
      }, {
        buildVariable(result) {
          const row = result.result.content[0];
          CheckUtil.expectEqual(row.linkNoteId != null && row.linkNoteId !== 0, true, '餐厅单缺少链接单');
          return {
            linkNoteId: row.linkNoteId
          };
        }
      }),
      new QueryAction({
        name: '查询订单物料（改价前）',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${noteId}'
        }
      }, {
        buildVariable(result) {
          return {
            noteItems: result.result.content
          };
        }
      }),
      ...this.buildVerifyAfterUpdate({
        name: '入库后',
        noteInstockCost: 846,
        storeItems: [
          { name: '猪肉', price: 21, instockCnt: 400, instockCost: 840 },
          { name: '羊肉', price: 0.2, instockCnt: 30, instockCost: 6 }
        ],
        stocks: [
          { name: '猪肉', cnt: 400, buyUnitFee: 1, cost: 840 },
          { name: '羊肉', cnt: 30, buyUnitFee: 500, cost: 6 },
          { name: '牛肉', cnt: 50, buyUnitFee: 1, cost: 500 }
        ]
      }),

      new UpdateCntAndPrice({
        name: '只改猪肉价格',
        changes: [{
          name: '猪肉',
          price: 25,
          stockBuyUnitFee: -10
        }],
        highlight:true
      }),
      ...this.buildVerifyAfterUpdate({
        name: '只改价格后',
        noteInstockCost: 1006,
        storeItems: [
          { name: '猪肉', price: 25, instockCnt: 400, instockCost: 1000 },
          { name: '羊肉', price: 0.2, instockCnt: 30, instockCost: 6 }
        ],
        stocks: [
          { name: '猪肉', cnt: 400, buyUnitFee: 1, cost: 1000 },
          { name: '羊肉', cnt: 30, buyUnitFee: 500, cost: 6 },
          { name: '牛肉', cnt: 50, buyUnitFee: 1, cost: 500 }
        ]
      }),

      new UpdateCntAndPrice({
        name: '改羊肉价格与入库数量',
        changes: [{
          name: '羊肉',
          price: 0.25,
          stockBuyUnitFee: 500,
          instockCnt: 20
        }],
        highlight:true
      }),
      ...this.buildVerifyAfterUpdate({
        name: '改价改量后',
        noteInstockCost: 1005,
        storeItems: [
          { name: '猪肉', price: 25, instockCnt: 400, instockCost: 1000 },
          { name: '羊肉', price: 0.25, instockCnt: 20, instockCost: 5 }
        ],
        stocks: [
          { name: '猪肉', cnt: 400, buyUnitFee: 1, cost: 1000 },
          { name: '羊肉', cnt: 20, buyUnitFee: 500, cost: 5 },
          { name: '牛肉', cnt: 50, buyUnitFee: 1, cost: 500 }
        ]
      })
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

  /** 餐厅视角：instockCnt+buyUnitFee、price+stockBuyUnitFee */
  private checkStoreNoteItems(content: any[], items: StoreItemExpect[]) {
    for (const expect of items) {
      const row = content.find(item => item.name === expect.name);
      CheckUtil.expectEqual(row != null, true, `未找到物料${expect.name}`);
      CheckUtil.expectEqual(row.price, expect.price, `${expect.name}单价不对`);
      CheckUtil.expectEqual(
        StockUtil.isEq(
          StockUtil.storeStockFromNoteItem(row),
          { cnt: expect.instockCnt, buyUnitFee: row.instock.buyUnitFee }
        ),
        true,
        `${expect.name}入库数量不对`
      );
      CheckUtil.expectEqual(row.instockCost, expect.instockCost, `${expect.name}入库金额不对`);
    }
  }

  /**
   * 供应商视角：用双方 listNoteItem.linkUnitFee 做 parseCnt/parsePriceFee，
   * 再用 isEq / isEqPrice 比 linkInstockCnt、linkPrice。
   */
  private checkSupplierNoteItems(
    supplierItems: any[],
    storeItems: StoreItemExpect[],
    storeNoteItems: any[]
  ) {
    for (const expect of storeItems) {
      const storeRow = storeNoteItems.find(item => item.name === expect.name);
      const supplierRow = supplierItems.find(item => item.noteItemId === storeRow?.linkNoteItemId);
      LinkNoteItemUtil.compareStoreAndLink(storeRow, supplierRow);
    }
  }

  private buildVerifyAfterUpdate(opt: VerifyOpt): BaseTest[] {
    const variable = this.getVariable();
    const self = this;
    return [
      new QueryAction({
        name: `${opt.name}验证餐厅单入库金额`,
        url: '/app/note/listNote',
        query: {
          noteId: '${noteId}'
        }
      }, {
        check(result) {
          const row = result.result.content[0];
          CheckUtil.expectEqual(row.instockCost, opt.noteInstockCost, '餐厅单入库金额不对');
        }
      }),
      new QueryAction({
        name: `${opt.name}验证餐厅单物料`,
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${noteId}'
        }
      }, {
        buildVariable(result) {
          const content: any[] = result.result.content;
          return {
            noteItems: content,
            linkNoteItemIds: ArrayUtil.toArray(content, 'linkNoteItemId')
          };
        },
        check(result) {
          self.checkStoreNoteItems(result.result.content, opt.storeItems);
        }
      }),
      new QueryAction({
        name: `${opt.name}验证链接单对方入库金额`,
        url: '/app/note/listNote',
        query: {
          noteId: '${linkNoteId}'
        }
      }, {
        warehouseType: 'supplierWarehouse',
        check(result) {
          const row = result.result.content[0];
          CheckUtil.expectEqual(row.linkInstockCost, opt.noteInstockCost, '链接单对方入库金额不对');
        }
      }),
      new QueryAction({
        name: `${opt.name}验证链接单物料`,
        url: '/app/noteItem/listNoteItem',
        query: {
          noteItemId: '${linkNoteItemIds}'
        }
      }, {
        warehouseType: 'supplierWarehouse',
        check(result) {
          self.checkSupplierNoteItems(
            result.result.content,
            opt.storeItems,
            variable.noteItems
          );
        }
      }),
      new Recal(),
      new CheckStock({
        array: opt.stocks.map(row => ({
          materialId: `\${materialMap.${row.name}.materialId}`,
          cnt: row.cnt,
          buyUnitFee: row.buyUnitFee ?? 1
        }))
      }),
      new CheckArray([{
        table: 'stock',
        check(array) {
          for (const row of opt.stocks) {
            const materialId = variable.materialMap[row.name].materialId;
            const stock = array.find(item => item.materialId === materialId);
            CheckUtil.expectEqual(stock != null, true, `${row.name}库存不存在`);
            CheckUtil.expectEqual(stock.cost, row.cost, `${row.name}库存金额不对`);
          }
        }
      }])
    ];
  }
}

import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import PreNote from "../PreNote";
import Action from "../../action/Action";
import QueryAction from "../../action/QueryAction";
import UpdateCntAndPrice from "../../action/note/UpdateCntAndPrice";
import CheckArray from "../../action/CheckArray";

interface CostExpect {
  instockCost: number;
  statementCost: number;
}

interface ItemExpect {
  price: number;
  instockCost: number;
  statementCost: number;
}

/**
 * 验证 noteDomain.onUpdatePrice 在订单已加入对账单时，会 refresh 对账单金额。
 * 改价/改量须同时校验 billDo.instockCost、billDo.statementCost。
 * 只测餐厅端，不测供应商端。
 *
 * 说明：入对账单后 statementCnt 固定；改 instockCnt 时
 * instockCost 按新入库量算，statementCost 按 statementCnt×新单价算，两者可能不同。
 */
export default class extends TestCase {
  getName(): string {
    return '改价后刷新对账单';
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    const self = this;

    // 猪肉/白菜: cnt=10, price=20 → 各 200，合计 400；statementCnt=instockCnt=10
    const before: CostExpect = { instockCost: 400, statementCost: 400 };

    // 调大：猪肉价 20→25、量 10→15
    // 猪肉 instockCost=15*25=375；statementCost=10*25=250；白菜 200
    const afterUp: CostExpect = { instockCost: 575, statementCost: 450 };
    const afterUpItems: Record<string, ItemExpect> = {
      猪肉: { price: 25, instockCost: 375, statementCost: 250 },
      白菜: { price: 20, instockCost: 200, statementCost: 200 }
    };

    // 再调小：猪肉价 25→15、量 15→8
    // 猪肉 instockCost=8*15=120；statementCost=10*15=150；白菜 200
    const afterDown: CostExpect = { instockCost: 320, statementCost: 350 };
    const afterDownItems: Record<string, ItemExpect> = {
      猪肉: { price: 15, instockCost: 120, statementCost: 150 },
      白菜: { price: 20, instockCost: 200, statementCost: 200 }
    };

    return [
      new PreTest(),
      new PreNote({
        cnt: 10,
        price: 20,
        names: ['猪肉', '白菜'],
        needInstock: true,
        needNoteItems: true
      }),

      new Action({
        url: '/app/note/schNote4Bill',
        name: '查询可对账订单',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        buildVariable(result) {
          const content = result.result.content;
          CheckUtil.expectEqual(content.length > 0, true, '没有可对账订单');
          return {
            noteIds: ArrayUtil.toArray(content, 'noteId'),
            noteId: content[0].noteId
          };
        }
      }),

      new Action({
        url: '/app/bill/createBill',
        name: '订单加入对账单',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          noteIds: '${noteIds}'
        }
      }, {
        check(result) {
          const bill = result.result;
          CheckUtil.expectEqual(bill.noteCnt, 1, '对账单订单数不对');
          CheckUtil.expectEqual(bill.itemCnt, 2, '对账单物料数不对');
          checkBillCosts(bill, before, '加入对账单');
        },
        buildVariable(result) {
          return {
            billId: result.result.billId
          };
        }
      }),

      new QueryAction({
        name: '改价前确认订单已关联对账单',
        url: '/app/note/listNote',
        query: {
          noteId: '${noteId}'
        }
      }, {
        check(result) {
          const row = result.result.content[0];
          CheckUtil.expectEqual(row.billId != null && row.billId !== 0, true, '订单未关联对账单');
          checkNoteCosts(row, before, '改价前订单');
        }
      }),

      new CheckArray([{
        table: 'bill',
        notWarhouseId: true,
        check(array) {
          const bill = array.find(row => row.billId === variable.billId);
          CheckUtil.expectEqual(bill != null, true, '库表未找到对账单');
          checkBillCosts(bill, before, '改前库表bill');
        }
      }]),

      new QueryAction({
        name: '查询订单物料（改前）',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${noteId}'
        }
      }, {
        buildVariable(result) {
          return {
            noteItems: result.result.content
          };
        },
        check(result) {
          checkNoteItemCosts(result.result.content, {
            猪肉: { price: 20, instockCost: 200, statementCost: 200 },
            白菜: { price: 20, instockCost: 200, statementCost: 200 }
          }, '改前物料');
        }
      }),

      // —— 先调大价格和数量 ——
      new UpdateCntAndPrice({
        name: '调大猪肉价格和数量',
        changes: [{
          name: '猪肉',
          price: 25,
          stockBuyUnitFee: 1,
          instockCnt: 15
        }],
        highlight: true
      }),
      ...self.buildVerifyAfterChange('调大后', afterUp, afterUpItems),

      // —— 再调小价格和数量 ——
      new QueryAction({
        name: '查询订单物料（调小前）',
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
      new UpdateCntAndPrice({
        name: '调小猪肉价格和数量',
        changes: [{
          name: '猪肉',
          price: 15,
          stockBuyUnitFee: 1,
          instockCnt: 8
        }],
        highlight: true
      }),
      ...self.buildVerifyAfterChange('调小后', afterDown, afterDownItems)
    ];
  }

  /** 订单 + listBill + 库表 bill + 物料，均校验 instockCost / statementCost */
  private buildVerifyAfterChange(
    tag: string,
    costs: CostExpect,
    items: Record<string, ItemExpect>
  ): BaseTest[] {
    const variable = this.getVariable();
    return [
      new QueryAction({
        name: `${tag}验证订单金额`,
        url: '/app/note/listNote',
        query: {
          noteId: '${noteId}'
        }
      }, {
        check(result) {
          checkNoteCosts(result.result.content[0], costs, `${tag}订单`);
        }
      }),
      new Action({
        url: '/app/bill/listBill',
        name: `${tag}验证对账单金额`,
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        check(result) {
          const content: any[] = result.result.content;
          const bill = content.find(row => row.billId === variable.billId);
          CheckUtil.expectEqual(bill != null, true, '对账单不存在');
          CheckUtil.expectEqual(bill.noteCnt, 1, '对账单订单数被改乱');
          CheckUtil.expectEqual(bill.itemCnt, 2, '对账单物料数被改乱');
          checkBillCosts(bill, costs, `${tag}listBill`);
        }
      }),
      new CheckArray([{
        table: 'bill',
        notWarhouseId: true,
        check(array) {
          const bill = array.find(row => row.billId === variable.billId);
          CheckUtil.expectEqual(bill != null, true, '库表未找到对账单');
          checkBillCosts(bill, costs, `${tag}库表bill`);
        }
      }]),
      new QueryAction({
        name: `${tag}验证订单物料金额`,
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${noteId}'
        }
      }, {
        check(result) {
          checkNoteItemCosts(result.result.content, items, `${tag}物料`);
        }
      })
    ];
  }
}

function checkBillCosts(bill: any, expect: CostExpect, tag: string) {
  CheckUtil.expectEqual(bill.instockCost, expect.instockCost, `${tag}.instockCost不对`);
  CheckUtil.expectEqual(bill.statementCost, expect.statementCost, `${tag}.statementCost不对`);
}

function checkNoteCosts(note: any, expect: CostExpect, tag: string) {
  CheckUtil.expectEqual(note.instockCost, expect.instockCost, `${tag}.instockCost不对`);
  CheckUtil.expectEqual(note.statementCost, expect.statementCost, `${tag}.statementCost不对`);
}

function checkNoteItemCosts(
  content: any[],
  expectMap: Record<string, ItemExpect>,
  tag: string
) {
  for (const name of Object.keys(expectMap)) {
    const row = content.find(item => item.name === name);
    const expect = expectMap[name];
    CheckUtil.expectEqual(row != null, true, `${tag}未找到${name}`);
    CheckUtil.expectEqual(row.price, expect.price, `${tag}${name}.price不对`);
    CheckUtil.expectEqual(row.instockCost, expect.instockCost, `${tag}${name}.instockCost不对`);
    CheckUtil.expectEqual(row.statementCost, expect.statementCost, `${tag}${name}.statementCost不对`);
  }
}

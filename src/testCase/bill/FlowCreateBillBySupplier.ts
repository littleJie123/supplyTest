import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import PreNote from "../PreNote";
import Action from "../../action/Action";
import CheckCnt from "../../action/CheckCnt";

/**
 * 验证 /app/bill/createBillBySupplier：只收该供应商、未入账、status=instocked 的订单，
 * 创建后账单自动确认（confirm），订单变为 statement（见同目录 FlowCreateBillBySupplier.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '按供应商对账：只拉已入库订单并自动确认账单' });
  }

  getName(): string {
    return '按供应商创建对账单';
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new PreTest(),

      new PreNote({
        names: ['白菜', '猪肉'],
        cnt: 10,
        price: 20,
        needInstock: true,
        supplier: '供应商1'
      }).setRemark('供应商1：已入库订单（白菜+猪肉，金额400）'),

      new Action({
        name: '记录供应商1已入库订单',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          status: 'instocked'
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content ?? [];
          return {
            noteInstockedS1: content[0],
            noteIdInstockedS1: content[0]?.noteId
          };
        },
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 1, `供应商1入库后应只有1单instocked,实际${content.length}`);
        }
      }).setRemark('listNote 记下 instocked 订单，后续断言只对这一单入账'),

      new PreNote({
        names: ['鸡蛋'],
        cnt: 5,
        price: 10,
        needInstock: false,
        supplier: '供应商1'
      }).setRemark('供应商1：仅发送未入库订单（不应进对账单）'),

      new PreNote({
        names: ['羊肉'],
        cnt: 8,
        price: 15,
        needInstock: true,
        supplier: '供应商2'
      }).setRemark('供应商2：已入库订单（按供应商1对账时不应卷入）'),

      new Action({
        name: 'createBillBySupplier',
        url: '/app/bill/createBillBySupplier',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          supplierId: '${supplierMap.供应商1}'
        }
      }).setRemark('对供应商1一键创建对账单（只应包含其 instocked 且未入账订单）'),

      new Action({
        name: '校验对账单',
        url: '/app/bill/listBill',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          let supplierId = variable.supplierMap?.['供应商1'];
          let bills = content.filter(b => String(b.supplierId) === String(supplierId));
          CheckUtil.expectEqual(bills.length, 1, `供应商1应对应1张账单,实际${bills.length}`);
          let bill = bills[0];
          CheckUtil.expectEqual(bill.status, 'confirm', `账单应自动确认,实际=${bill.status}`);
          CheckUtil.expectEqual(bill.noteCnt, 1, `账单订单数应为1,实际=${bill.noteCnt}`);
          CheckUtil.expectEqual(Number(bill.instockCost), 400, `入库金额应为400,实际=${bill.instockCost}`);
        }
      }).setRemark('账单 status=confirm，noteCnt=1，instockCost=400（10*20*2）'),

      new CheckCnt([
        {
          table: 'note',
          query: {
            status: 'instocked',
            supplierId: '${supplierMap.供应商1}'
          },
          cnt: 0
        }
      ]).setRemark('供应商1已入库单应对账后变为statement，instocked剩0'),

      new CheckCnt([
        {
          table: 'note',
          query: {
            status: 'statement',
            supplierId: '${supplierMap.供应商1}'
          },
          cnt: 1
        }
      ]).setRemark('供应商1应对账后有1单statement'),

      new CheckCnt([
        {
          table: 'note',
          query: {
            status: 'instocked',
            supplierId: '${supplierMap.供应商2}'
          },
          cnt: 1
        }
      ]).setRemark('供应商2入库单仍为instocked，未被供应商1对账卷入'),

      new CheckCnt([
        {
          table: 'note',
          query: {
            status: 'normal',
            supplierId: '${supplierMap.供应商1}'
          },
          cnt: 1
        }
      ]).setRemark('供应商1未入库单仍为normal，未进对账单')
    ];
  }
}

import { BaseTest, CheckUtil, TestCase } from 'testflow';
import PreTest from '../PreTest';
import Action from '../../action/Action';
import AddPurcharse from '../../action/note/AddPurcharse';
import CreateNote3M from '../../action/note/CreateNote3M';

const URL = '/app/stallMaterialInfo/schStallMaterialInfo4Purcharse';

/**
 * 订货暂存查询 SchStallMaterialInfo4Purcharse（见同目录 md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '订货暂存：空→加订货→校验 content/money→下单后清空' });
  }

  getName(): string {
    return '订货暂存查询';
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new PreTest().setRemark('初始化餐厅、供应商、物料'),

      this.buildSchAction({
        remark: '尚无订货暂存，content 为空、money=0',
        name: '查询订货-空',
        check(result) {
          const content = result?.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 0, `应无订货行，实际=${content.length}`);
          CheckUtil.expectEqual(result?.result?.money, 0, `money 应为 0，实际=${result?.result?.money}`);
        }
      }),

      new AddPurcharse({
        name: '牛肉',
        stock: { cnt: 50, buyUnitFee: 1, stockUnitsId: 18 }
      }).setRemark('订货：牛肉 50（单价 10，预期 money=500）'),

      this.buildSchAction({
        remark: '仅牛肉：1 条、stock/供应商价、money=500，无 supplier/stallStocks',
        name: '查询订货-仅牛肉',
        check(result) {
          const content = result?.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, `应 1 条，实际=${content.length}`);
          const beefId = variable.materialMap?.牛肉?.materialId;
          const row = content.find((r: any) => r.materialId === beefId);
          CheckUtil.expectEqual(row != null, true, `未找到牛肉 materialId=${beefId}`);
          CheckUtil.expectEqual(row.stock?.cnt, 50, `牛肉 cnt 应为 50，实际=${row.stock?.cnt}`);
          CheckUtil.expectEqual(row.stock?.buyUnitFee, 1, `牛肉 buyUnitFee 应为 1`);
          CheckUtil.expectEqual(row.supplierMaterial != null, true, '应有 supplierMaterial');
          CheckUtil.expectEqual(row.supplierMaterial?.price, 10, `牛肉默认价 10，实际=${row.supplierMaterial?.price}`);
          CheckUtil.expectEqual(row.supplier == null, true, 'noSupplier 时不应挂 supplier');
          CheckUtil.expectEqual(row.stock?.stallStocks == null, true, '应删除 stallStocks');
          CheckUtil.expectEqual(Array.isArray(row.buyUnit), true, '应挂 buyUnit 规格');
          CheckUtil.expectEqual(result?.result?.money, 500, `money 应为 500，实际=${result?.result?.money}`);
        }
      }),

      new AddPurcharse({
        name: '猪肉',
        stock: { cnt: 400, buyUnitFee: 1, stockUnitsId: 18 }
      }).setRemark('订货：猪肉 400'),

      new AddPurcharse({
        name: '羊肉',
        stock: { cnt: 30, buyUnitFee: 500, stockUnitsId: 29 }
      }).setRemark('订货：羊肉 30（瓶 fee=500）'),

      this.buildSchAction({
        remark: '三物料订货：条数/数量对齐，money 按返回价与 fee 重算',
        name: '查询订货-三物料',
        check(result) {
          const content = result?.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 3, `应 3 条，实际=${content.length}`);

          const expectStocks: Record<string, { cnt: number; buyUnitFee: number }> = {
            牛肉: { cnt: 50, buyUnitFee: 1 },
            猪肉: { cnt: 400, buyUnitFee: 1 },
            羊肉: { cnt: 30, buyUnitFee: 500 }
          };
          let expectMoney = 0;
          for (const name of Object.keys(expectStocks)) {
            const materialId = variable.materialMap?.[name]?.materialId;
            const row = content.find((r: any) => r.materialId === materialId);
            CheckUtil.expectEqual(row != null, true, `未找到${name} materialId=${materialId}`);
            const expect = expectStocks[name];
            CheckUtil.expectEqual(row.stock?.cnt, expect.cnt, `${name} cnt 应为 ${expect.cnt}`);
            CheckUtil.expectEqual(row.stock?.buyUnitFee, expect.buyUnitFee, `${name} buyUnitFee 应为 ${expect.buyUnitFee}`);
            CheckUtil.expectEqual(row.supplierMaterial != null, true, `${name} 应有 supplierMaterial`);
            CheckUtil.expectEqual(row.supplier == null, true, `${name} 不应有 supplier`);
            CheckUtil.expectEqual(row.stock?.stallStocks == null, true, `${name} 应无 stallStocks`);
            expectMoney += calMoneyLikeServer(row.stock, row.supplierMaterial);
          }
          expectMoney = round2(expectMoney);
          CheckUtil.expectEqual(
            result?.result?.money,
            expectMoney,
            `money 应为 ${expectMoney}，实际=${result?.result?.money}`
          );
        }
      }),

      new CreateNote3M().setRemark('下单并发送：清空订货暂存'),

      this.buildSchAction({
        remark: '发送后订货暂存已清空',
        name: '查询订货-下单后为空',
        check(result) {
          const content = result?.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 0, `下单后应无订货行，实际=${content.length}`);
          CheckUtil.expectEqual(result?.result?.money, 0, `money 应为 0，实际=${result?.result?.money}`);
        }
      })
    ];
  }

  private buildSchAction(opt: {
    remark: string;
    name: string;
    check: (result: any) => void;
  }): BaseTest {
    return new Action({
      remark: opt.remark,
      name: opt.name,
      url: URL,
      method: 'POST',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check: opt.check
    });
  }
}

/** 与 StockDomain.calMoney + calCntWithFee（Caler）一致的金额计算，用于断言 money */
function calMoneyLikeServer(stock: any, price: any): number {
  if (stock?.cnt == null || price?.price == null) {
    return 0;
  }
  if (stock.cnt === 0 || price.price === 0) {
    return 0;
  }
  const stockCnt = calCntWithFee(stock, { buyUnitFee: price.buyUnitFee });
  return round2(stockCnt * price.price);
}

function calCntWithFee(stockCnt: any, lastStockCnt: any): number {
  let stockNum = stockCnt?.cnt;
  if (stockNum == null) {
    return 0;
  }
  if (stockCnt.buyUnitFee === lastStockCnt.buyUnitFee) {
    return stockNum;
  }
  const calers = [
    buildCaler(stockCnt, true),
    buildCaler(lastStockCnt, false)
  ].sort((a, b) => a.sort - b.sort);
  for (const caler of calers) {
    stockNum = caler.cal(stockNum);
  }
  return stockNum;
}

function buildCaler(stockCnt: any, self: boolean): { sort: number; cal: (n: number) => number } {
  const fee = stockCnt.buyUnitFee;
  let oper: '*' | '/';
  if (fee > 0) {
    oper = self ? '/' : '*';
  } else {
    oper = self ? '*' : '/';
  }
  return {
    sort: oper === '*' ? 0 : 1,
    cal(num: number) {
      if (fee == null || fee === 1 || isNaN(fee)) {
        return num;
      }
      const abs = Math.abs(fee);
      return oper === '*' ? num * abs : num / abs;
    }
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

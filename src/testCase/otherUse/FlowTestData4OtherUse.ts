import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTestWithMeat from "../PreTestWithMeat";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";

/**
 * 其他消耗相关测试数据（依赖 PreTestWithMeat）：
 * - 羊肉/牛肉已是 1包=100克；猪肉为克
 * - 盘点：羊肉标准单位克 → buyUnitFee=-100；牛肉标准单位包 → buyUnitFee=1
 * - 单价按每克 1 元计 cost
 *
 * 盘点：
 * - 2026-06-01：牛肉 2包(fee:1,cost:200)、羊肉 4包(fee:-100,cost:400)
 * - 2026-07-01：牛肉 3包(fee:1,cost:300)、羊肉 6包(fee:-100,cost:600)
 */
export default class extends TestCase {
  getName(): string {
    return 'FlowTestData4OtherUse'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new PreTestWithMeat(),

      new Action({
        name: '盘点2026-06-01(牛肉2包/羊肉4包)',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-06-01',
          array: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 2,
              buyUnitFee: 1,
              cost: 200
            },
            {
              materialId: '${materialMap.羊肉.materialId}',
              cnt: 4,
              buyUnitFee: -100,
              cost: 400
            }
          ]
        }
      }),

      new Action({
        name: '盘点2026-07-01(牛肉3包/羊肉6包)',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-07-01',
          array: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 3,
              buyUnitFee: 1,
              cost: 300
            },
            {
              materialId: '${materialMap.羊肉.materialId}',
              cnt: 6,
              buyUnitFee: -100,
              cost: 600
            }
          ]
        }
      }),

      new Recal(),
      new CheckStock({
        array: [
          {
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 3,
            buyUnitFee: 1
          },
          {
            materialId: '${materialMap.羊肉.materialId}',
            cnt: 6,
            buyUnitFee: -100
          }
        ]
      }),
      new CheckArray([{
        table: 'stock',
        check(array) {
          let expects = [
            { name: '牛肉', cost: 300 },
            { name: '羊肉', cost: 600 }
          ];
          for (let expect of expects) {
            let materialId = variable.materialMap?.[expect.name]?.materialId;
            let stock = array.find((row: any) => String(row.materialId) === String(materialId));
            CheckUtil.expectEqual(stock != null, true, `${expect.name}库存不存在`);
            CheckUtil.expectEqual(stock.cost, expect.cost, `${expect.name}库存金额不对`);
          }
        }
      }])
    ]
  }
}

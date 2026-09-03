import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import QueryAction from "../../action/QueryAction";

/**
 * 营业额 save/list（见同目录 FlowTurnover.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '营业额：保存月/日数据→按月查询→更新与软删→再查询校验' });
  }

  getName(): string {
    return '营业额';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest().setRemark('初始化餐厅、供应商、物料'),

      new Action({
        name: '保存1月营业额',
        remark: '保存月营业额10000，1日 hand 300、2日 auto 400（2日有真实营业额350）',
        url: '/app/turnover/saveTurnover',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          array: [
            {
              type: 'month',
              date: '2026-01',
              money: 10000,
              setType: 'hand'
            },
            {
              type: 'day',
              date: '2026-01-01',
              money: 300,
              setType: 'hand'
            },
            {
              type: 'day',
              date: '2026-01-02',
              money: 400,
              realMoney: 350,
              setType: 'auto'
            }
          ]
        }
      }),

      new QueryAction({
        name: '查询1月营业额',
        url: '/app/turnover/listTurnover',
        query: {
          warehouseId: '${warehouse.warehouseId}',
          month: '202601'
        },
        checkers: {
          len: 3,
          checkArray: [
            { type: 'month', date: '2026-01', money: 10000, setType: 'hand' },
            { type: 'day', date: '2026-01-01', money: 300, setType: 'hand' },
            { type: 'day', date: '2026-01-02', money: 400, realMoney: 350, setType: 'auto' }
          ]
        }
      }).setRemark('month=202601，应返回月行+两日行共3条'),

      new Action({
        name: '更新1月营业额',
        remark: '月营业额改为12000；删掉1日；2日 money 改为500；新增3日 450',
        url: '/app/turnover/saveTurnover',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          array: [
            {
              type: 'month',
              date: '2026-01',
              money: 12000,
              setType: 'hand'
            },
            {
              type: 'day',
              date: '2026-01-02',
              money: 500,
              realMoney: 350,
              setType: 'auto'
            },
            {
              type: 'day',
              date: '2026-01-03',
              money: 450,
              setType: 'hand'
            }
          ]
        }
      }),

      new QueryAction({
        name: '查询更新后1月营业额',
        url: '/app/turnover/listTurnover',
        query: {
          warehouseId: '${warehouse.warehouseId}',
          month: '2026-01'
        },
        checkers: {
          len: 3,
          checkArray: [
            { type: 'month', date: '2026-01', money: 12000 },
            { type: 'day', date: '2026-01-02', money: 500, realMoney: 350 },
            { type: 'day', date: '2026-01-03', money: 450, setType: 'hand' }
          ]
        }
      }, {
        check(result) {
          let content: any[] = result.result.content;
          let day1 = content.find(row => row.date == '2026-01-01');
          CheckUtil.expectEqual(day1, null);
        }
      }).setRemark('应剩3条：月12000、2日500、3日450；1日已被软删'),

      new Action({
        name: '保存2月营业额',
        remark: '另存2月月营业额8000，验证按月隔离',
        url: '/app/turnover/saveTurnover',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          array: [
            {
              type: 'month',
              date: '2026-02',
              money: 8000,
              setType: 'hand'
            },
            {
              type: 'day',
              date: '2026-02-01',
              money: 200,
              setType: 'auto'
            }
          ]
        }
      }),

      new QueryAction({
        name: '查询2月营业额',
        url: '/app/turnover/listTurnover',
        query: {
          warehouseId: '${warehouse.warehouseId}',
          month: '202602'
        },
        checkers: {
          len: 2,
          checkArray: [
            { type: 'month', date: '2026-02', money: 8000 },
            { type: 'day', date: '2026-02-01', money: 200, setType: 'auto' }
          ]
        }
      }, {
        check(result) {
          let content: any[] = result.result.content;
          let jan = content.find(row => String(row.date).indexOf('2026-01') == 0);
          CheckUtil.expectEqual(jan, null);
        }
      }).setRemark('month=202602 只应返回2月2条，不含1月'),

      new Action({
        name: '查询物料单位',
        remark: '查询物料以获取正确的 unitsId',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          const material = result.result.content[0]; // 取第一个物料
          if (material == null) throw new Error('没有物料');
          const unitsId = material.buyUnit?.[0]?.unitsId ?? material.stockUnitsId;
          return { dosageUnitsId: unitsId };
        }
      }),

      new Action({
        name: '新增校验RecommendHat物料',
        remark: '每天报货、在途0；安全库存10；千元用量2',
        url: '/app/material/SaveMaterial',
        method: 'POST',
        param: {
          name: 'RecommendHat测试物料',
          buyUnit: [{ isSupplier: true, name: '斤', fee: 1 }],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: 10,
            orderType: 'day',
            orderDay: '0',
            daysInTransit: 0
          }],
          safeStock: {
            cnt: 10,
            stockUnitsName: '斤',
            needRoundUp: 0,
            dosageCnt: 2,
            dosageUnitsId: '${dosageUnitsId}'
          },
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),

      new Action({
        name: 'listMaterialByCategory校验推荐报货',
        remark: '期望 recommentCnt.cnt 基于营业额计算',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          const material = result.result.content.find((row: any) => row.name === 'RecommendHat测试物料');
          if (material == null) throw new Error('未找到物料');
          if (material.recommentCnt == null) throw new Error('缺少 recommentCnt');
          // 营业额计算逻辑依赖具体数据，这里校验字段存在性，业务正确性由FlowRecommend覆盖
          CheckUtil.expectNotNull(material.recommentCnt.cnt, 'recommentCnt.cnt');
        }
      })
    ];
  }
}

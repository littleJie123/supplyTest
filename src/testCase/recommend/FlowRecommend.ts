import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";

function formatDate(date: Date): string {
  let str = date.getFullYear() + '-';
  const month = date.getMonth() + 1;
  str += month < 10 ? '0' + month : month;
  str += '-';
  const day = date.getDate();
  str += day < 10 ? '0' + day : day;
  return str;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function findMaterial(content: any[], name: string) {
  const material = content.find(row => row.name === name);
  if (material == null) {
    throw new Error(`未找到物料: ${name}`);
  }
  return material;
}

function calcMonthOrderDay(offset: number): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.getDate();
}

function calcWeekOrderDay(offset: number): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.getDay();
}

function calcNextNextOrderDate(orderType: string, orderDay: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cursor = new Date(today);
  let count = 0;
  let guard = 0;

  while (count < 2 && guard < 800) {
    const isOrder =
      orderType === 'day'
        ? true
        : orderType === 'week'
          ? cursor.getDay() === orderDay
          : cursor.getDate() === orderDay;

    if (isOrder) {
      count += 1;
      if (count === 2) {
        return formatDate(cursor);
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  throw new Error(`无法计算下下次报货日: ${orderType}/${orderDay}`);
}

function calcExpectedRecommend(spec: {
  name: string;
  dosageCnt?: number;
  safeCnt: number;
  currentCnt: number;
  needRoundUp: boolean;
  orderType?: string;
  orderDay?: number;
  daysInTransit?: number;
  supplierOrderType?: string;
  supplierOrderDay?: number;
  supplierDaysInTransit?: number;
  turnoverSum: number;
}) {
  let value = 0;
  if (spec.dosageCnt != null) {
    value += (spec.turnoverSum / 1000) * spec.dosageCnt;
  }
  value += spec.safeCnt;
  value -= spec.currentCnt;

  if (spec.needRoundUp) {
    return Math.round(value);
  }
  return value;
}

/**
 * RecommendHat 推荐报货量（见同目录 FlowRecommend.md）。
 *
 * 场景覆盖：
 * - 青菜：按月报货，千元用量参与计算
 * - 豆芽：无报货日，仅按安全库存-库存取整
 * - 西葫芦：按供应商周报货，走 supplier schedule
 * - 供应商1：按周报货，2天后发单
 */
export default class extends TestCase {
  constructor() {
    super({ remark: 'RecommendHat：按动态报货日与营业额窗口计算 recommentCnt' });
  }

  getName(): string {
    return '推荐报货';
  }

  protected buildActions(): BaseTest[] {
    const today = formatDate(new Date());
    const monthOrderDay = calcMonthOrderDay(3);
    const weekOrderDay = calcWeekOrderDay(2);
    const supplierWeekOrderDate = calcNextNextOrderDate('week', weekOrderDay);
    const businessOrderDate = calcNextNextOrderDate('month', monthOrderDay);

    const turnoverDates = Array.from({ length: 31 }, (_, index) => addDays(today, index));
    const turnoverSum = turnoverDates.length * 2000;

    const expectedCabbage = calcExpectedRecommend({
      name: '青菜',
      dosageCnt: 2,
      safeCnt: 1,
      currentCnt: 2,
      needRoundUp: false,
      turnoverSum
    });
    const expectedBeanSprout = calcExpectedRecommend({
      name: '豆芽',
      safeCnt: 3,
      currentCnt: 1.5,
      needRoundUp: true,
      turnoverSum: 0
    });
    const expectedZucchini = calcExpectedRecommend({
      name: '西葫芦',
      safeCnt: 4,
      currentCnt: 0.5,
      needRoundUp: true,
      turnoverSum: 0
    });

    return [
      new PreTest().setRemark('初始化餐厅、供应商、物料'),

      new Action({
        name: '更新供应商1为按周报货',
        remark: `供应商1：按周报货，${weekOrderDay} 对应的星期日/一等，2天后发单，0日在途`,
        url: '/app/supplier/updateSupplier',
        param: {
          supplierId: '${supplierMap.供应商1}',
          name: '供应商1',
          orderType: 'week',
          orderDay: String(weekOrderDay),
          daysInTransit: 0
        }
      }),

      new Action({
        name: '新增青菜：按月报货 + 千元用量',
        remark: `按月报货，月中${monthOrderDay}日作为发单日，3天后发单；在途1天；安全库存1包，库存2包，dosageCnt=2`,
        url: '/app/material/SaveMaterial',
        method: 'POST',
        param: {
          name: '青菜',
          remark: '',
          img: [],
          buyUnit: [
            { name: '包', fee: 1 },
            { name: '斤', fee: 10 }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: 12,
            orderType: 'month',
            orderDay: String(monthOrderDay),
            daysInTransit: 1
          }],
          safeStock: {
            cnt: 1,
            stockUnitsName: '包',
            needRoundUp: 0,
            dosageCnt: 2,
            dosageUnitsName: '包'
          },
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          return { materialBeefId: result.result.materialId };
        }
      }),

      new Action({
        name: '新增豆芽：只设安全库存并取整',
        remark: '无报货日配置，安全库存 3 包，当前库存 1.5 包，needRoundUp=1',
        url: '/app/material/SaveMaterial',
        method: 'POST',
        param: {
          name: '豆芽',
          remark: '',
          img: [],
          buyUnit: [
            { name: '包', fee: 1 },
            { name: '斤', fee: 20 }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: 18,
            orderType: 'day',
            orderDay: '0',
            daysInTransit: 0
          }],
          safeStock: {
            cnt: 3,
            stockUnitsName: '包',
            needRoundUp: 1
          },
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          return { materialPorkId: result.result.materialId };
        }
      }),

      new Action({
        name: '新增西葫芦：跟随供应商按周报货',
        remark: '西葫芦供货关系为 supplier，供应商1按周报货；安全库存4包，当前库存0.5包，needRoundUp=1',
        url: '/app/material/SaveMaterial',
        method: 'POST',
        param: {
          name: '西葫芦',
          remark: '',
          img: [],
          buyUnit: [
            { name: '包', fee: 1 },
            { name: '斤', fee: 20 }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: 20,
            orderType: 'supplier',
            orderDay: '0',
            daysInTransit: 0
          }],
          safeStock: {
            cnt: 4,
            stockUnitsName: '包',
            needRoundUp: 1
          },
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          return { materialSheepId: result.result.materialId };
        }
      }),

      new Action({
        name: '保存 30 天营业额',
        remark: `全量设置${today}~${addDays(today, 30)}，每天2000元`,
        url: '/app/turnover/saveTurnover',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          array: turnoverDates.map(date => ({
            type: 'day',
            date,
            money: 2000,
            setType: 'hand'
          }))
        }
      }),

      new Action({
        name: '校验推荐报货列表',
        remark: `青菜期望=${expectedCabbage}，豆芽期望=${expectedBeanSprout}，西葫芦期望=${expectedZucchini}; 订单窗口动态按${today}计算`,
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          const rows = result.result.content;

          const cabbage = findMaterial(rows, '青菜');
          if (cabbage.recommentCnt == null) {
            throw new Error('青菜缺少 recommentCnt');
          }
          CheckUtil.expectEqual(Number(cabbage.recommentCnt.cnt), expectedCabbage, '青菜.recommentCnt');

          const beanSprout = findMaterial(rows, '豆芽');
          if (beanSprout.recommentCnt == null) {
            throw new Error('豆芽缺少 recommentCnt');
          }
          CheckUtil.expectEqual(Number(beanSprout.recommentCnt.cnt), expectedBeanSprout, '豆芽.recommentCnt');

          const zucchini = findMaterial(rows, '西葫芦');
          if (zucchini.recommentCnt == null) {
            throw new Error('西葫芦缺少 recommentCnt');
          }
          CheckUtil.expectEqual(Number(zucchini.recommentCnt.cnt), expectedZucchini, '西葫芦.recommentCnt');
        }
      }),

      new Action({
        name: '校验快捷订货推荐报货',
        remark: 'listMaterial4FastNote 与 listMaterialByCategory 保持一致',
        url: '/app/material/listMaterial4FastNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          const cabbage = findMaterial(result.result.content, '青菜');
          const beanSprout = findMaterial(result.result.content, '豆芽');
          const zucchini = findMaterial(result.result.content, '西葫芦');
          CheckUtil.expectEqual(Number(cabbage.recommentCnt.cnt), expectedCabbage, '青菜.fastNote.recommentCnt');
          CheckUtil.expectEqual(Number(beanSprout.recommentCnt.cnt), expectedBeanSprout, '豆芽.fastNote.recommentCnt');
          CheckUtil.expectEqual(Number(zucchini.recommentCnt.cnt), expectedZucchini, '西葫芦.fastNote.recommentCnt');
        }
      })
    ];
  }
}

import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";

const MATERIAL_NAME = '测试推荐报货';

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

/**
 * RecommendHat 推荐报货量（见同目录 FlowRecommend.md）。
 *
 * 每天报货、在途0：下下次到货日=明天；营业额今天1000+明天2000=3000；
 * dosageCnt=2 → 6；安全库存10；库存0 → recommentCnt=16
 */
export default class extends TestCase {
  constructor() {
    super({ remark: 'RecommendHat：营业额×千元用量+安全库存-库存 → recommentCnt' });
  }

  getName(): string {
    return '推荐报货';
  }

  protected buildActions(): BaseTest[] {
    const today = formatDate(new Date());
    const tomorrow = addDays(today, 1);

    return [
      new PreTest().setRemark('初始化餐厅、供应商、物料'),

      new Action({
        name: '新增推荐报货物料',
        remark: '每天报货、在途0；安全库存10；稍后补千元用量',
        url: '/app/material/SaveMaterial',
        method: 'POST',
        param: {
          name: MATERIAL_NAME,
          remark: '',
          img: [],
          buyUnit: [
            { isSupplier: true, name: '斤', fee: 1 }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: 10,
            orderType: 'day',
            orderDay: 0,
            daysInTransit: 0
          }],
          safeStock: {
            cnt: 10,
            stockUnitsName: '斤',
            needRoundUp: 0
          },
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          return {
            lastMaterialId: result.result.materialId
          };
        }
      }),

      new Action({
        name: '查询物料单位并写入千元用量',
        remark: 'listMaterialByCategory 取 unitsId，再 updateMaterial 设 dosageCnt=2',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          const material = findMaterial(result.result.content, MATERIAL_NAME);
          const unitsId = material.safeStock?.stockUnitsId ?? material.stockUnitsId;
          if (unitsId == null) {
            throw new Error('未拿到 unitsId');
          }
          return { dosageUnitsId: unitsId };
        }
      }),

      new Action({
        name: '更新千元用量',
        remark: 'dosageCnt=2，单位与安全库存相同',
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${lastMaterialId}',
          name: MATERIAL_NAME,
          remark: '',
          img: [],
          buyUnit: [
            { isSupplier: true, name: '斤', fee: 1 }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: 10,
            orderType: 'day',
            orderDay: 0,
            daysInTransit: 0
          }],
          safeStock: {
            cnt: 10,
            stockUnitsId: '${dosageUnitsId}',
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
        name: '保存今明两日营业额',
        remark: `今天${today}=1000，明天${tomorrow}=2000（真实营业额）`,
        url: '/app/turnover/saveTurnover',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          array: [
            {
              type: 'day',
              date: today,
              money: 1000,
              setType: 'hand'
            },
            {
              type: 'day',
              date: tomorrow,
              money: 2000,
              realMoney: 2000,
              setType: 'hand'
            }
          ]
        }
      }),

      new Action({
        name: 'listMaterialByCategory 校验推荐报货',
        remark: '期望 recommentCnt.cnt=16（3000/1000*2 + 10 - 0）',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          const material = findMaterial(result.result.content, MATERIAL_NAME);
          if (material.recommentCnt == null) {
            throw new Error('缺少 recommentCnt');
          }
          CheckUtil.expectEqual(material.recommentCnt.cnt, 16, 'recommentCnt.cnt');
        }
      }),

      new Action({
        name: 'listMaterial4FastNote 校验推荐报货',
        remark: '快捷订货接口同样返回 recommentCnt=16',
        url: '/app/material/listMaterial4FastNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          const material = findMaterial(result.result.content, MATERIAL_NAME);
          if (material.recommentCnt == null) {
            throw new Error('缺少 recommentCnt');
          }
          CheckUtil.expectEqual(material.recommentCnt.cnt, 16, 'recommentCnt.cnt');
        }
      })
    ];
  }
}

import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";

const MATERIAL_NAME = '测试千元用量';

function findMaterial(content: any[], name: string) {
  const material = content.find(row => row.name === name);
  if (material == null) {
    throw new Error(`未找到物料: ${name}`);
  }
  return material;
}

function findSupplier(content: any[], name: string) {
  const supplier = content.find(row => row.name === name);
  if (supplier == null) {
    throw new Error(`未找到供应商: ${name}`);
  }
  return supplier;
}

function checkOrder(row: any, opt: {
  orderType: string;
  orderDay: number;
  daysInTransit: number;
}, label: string) {
  CheckUtil.expectEqual(
    row.orderType,
    opt.orderType,
    `${label}.orderType 期望=${opt.orderType} 实际=${JSON.stringify(row?.orderType)} 整行=${JSON.stringify(row)}`
  );
  CheckUtil.expectEqual(row.orderDay, opt.orderDay, `${label}.orderDay 期望=${opt.orderDay} 实际=${JSON.stringify(row?.orderDay)}`);
  CheckUtil.expectEqual(row.daysInTransit, opt.daysInTransit, `${label}.daysInTransit 期望=${opt.daysInTransit} 实际=${JSON.stringify(row?.daysInTransit)}`);
}

/**
 * 物料/供应商报货日、在途、千元用量（见同目录 FlowDosage.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '供应商与物料：报货日/在途/千元用量保存与查询' });
  }

  getName(): string {
    return '千元用量物料供应商';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest().setRemark('初始化餐厅、供应商、物料'),

      new Action({
        name: '更新供应商报货日',
        remark: '供应商1：按周周一报货、次日到',
        url: '/app/supplier/updateSupplier',
        param: {
          supplierId: '${supplierMap.供应商1}',
          name: '供应商1',
          orderType: 'week',
          orderDay: 1,
          daysInTransit: 1
        }
      }),

      new Action({
        name: '查询供应商报货日',
        remark: 'listSupplier 校验供应商1的 orderType/orderDay/daysInTransit',
        url: '/app/supplier/listsupplier',
        param: {
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          const supplier = findSupplier(result.result.content, '供应商1');
          checkOrder(supplier, {
            orderType: 'week',
            orderDay: 1,
            daysInTransit: 1
          }, '供应商1');
        }
      }),

      new Action({
        name: '新增带报货日与安全库存的物料',
        remark: 'SaveMaterial：供应商物料按月5日报货、2日在途；安全库存 cnt=10',
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
            orderType: 'month',
            orderDay: 5,
            daysInTransit: 2
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
        },
        check(result) {
          if (result.result.materialId == null) {
            throw new Error('SaveMaterial 未返回 materialId');
          }
        }
      }),

      new Action({
        name: '查询新增物料报货日与安全库存',
        remark: 'listMaterialByCategory 校验 supplierMaterial 报货字段与 safeStock.cnt',
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
            throw new Error('未拿到 dosageUnitsId 可用的 unitsId');
          }
          return {
            dosageUnitsId: unitsId
          };
        },
        check(result) {
          const material = findMaterial(result.result.content, MATERIAL_NAME);
          if (material.supplierMaterial == null) {
            throw new Error(`物料 ${MATERIAL_NAME} 缺少 supplierMaterial`);
          }
          checkOrder(material.supplierMaterial, {
            orderType: 'month',
            orderDay: 5,
            daysInTransit: 2
          }, 'supplierMaterial');
          checkOrder(material.supplier, {
            orderType: 'week',
            orderDay: 1,
            daysInTransit: 1
          }, 'supplier');
          CheckUtil.expectEqual(material.safeStock?.cnt, 10, 'safeStock.cnt');
        }
      }),

      new Action({
        name: '更新物料报货日与千元用量',
        remark: 'updateMaterial：报货改为每天/0日在途；千元用量 dosageCnt=3',
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
            dosageCnt: 3,
            dosageUnitsId: '${dosageUnitsId}'
          },
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),

      new Action({
        name: '查询更新后物料',
        remark: '校验报货改为 day/0/0，safeStock.dosageCnt=3',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          const material = findMaterial(result.result.content, MATERIAL_NAME);
          checkOrder(material.supplierMaterial, {
            orderType: 'day',
            orderDay: 0,
            daysInTransit: 0
          }, 'supplierMaterial');
          CheckUtil.expectEqual(material.safeStock?.cnt, 10, 'safeStock.cnt');
          CheckUtil.expectEqual(material.safeStock?.dosageCnt, 3, 'safeStock.dosageCnt');
          CheckUtil.expectEqual(
            material.safeStock?.dosageUnitsId,
            material.safeStock?.stockUnitsId,
            'safeStock.dosageUnitsId'
          );
        }
      }),

      new Action({
        name: '新增带报货日的供应商',
        remark: 'addsupplier：按月10日报货、当天到',
        url: '/app/supplier/addsupplier',
        method: 'POST',
        param: {
          name: '供应商千元用量',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          type: 'supplier',
          orderType: 'month',
          orderDay: 10,
          daysInTransit: 0
        }
      }),

      new Action({
        name: '查询新增供应商报货日',
        remark: 'listSupplier 校验新供应商 orderType/orderDay/daysInTransit',
        url: '/app/supplier/listsupplier',
        param: {
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          const supplier = findSupplier(result.result.content, '供应商千元用量');
          checkOrder(supplier, {
            orderType: 'month',
            orderDay: 10,
            daysInTransit: 0
          }, '供应商千元用量');
        }
      })
    ];
  }
}

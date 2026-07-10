import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import UpdateMaterial from "../../action/material/UpdateMaterial";

const MATERIAL_NAME = '测试定时价';

function formatDate(date: Date): string {
  let str = date.getFullYear() + '-';
  const month = date.getMonth() + 1;
  str += month < 10 ? '0' + month : month;
  str += '-';
  const day = date.getDate();
  str += day < 10 ? '0' + day : day;
  return str;
}

function getToday(): string {
  return formatDate(new Date());
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function buildSuppliers(planPriceDate: string, planPrice: number, price = 10) {
  return [{
    isDef: true,
    supplierId: '${supplierMap.供应商1}',
    price,
    planPriceDate,
    planPrice,
  }];
}

function findMaterial(content: any[], name: string) {
  const material = content.find(row => row.name === name);
  if (material == null) {
    throw new Error(`未找到物料: ${name}`);
  }
  if (material.supplierMaterial == null) {
    throw new Error(`物料 ${name} 缺少 supplierMaterial`);
  }
  return material;
}

function checkSupplierMaterial(sm: any, opt: {
  price: number;
  planPriceDate?: string | null;
  planPrice?: number | null;
}) {
  CheckUtil.expectEqual(sm.price, opt.price);
  if (opt.planPriceDate == null) {
    if (sm.planPriceDate != null && sm.planPriceDate !== '') {
      throw new Error(`planPriceDate 应为空，实际 ${sm.planPriceDate}`);
    }
  } else {
    CheckUtil.expectEqual(sm.planPriceDate, opt.planPriceDate);
  }
  if (opt.planPrice == null) {
    if (sm.planPrice != null) {
      throw new Error(`planPrice 应为空，实际 ${sm.planPrice}`);
    }
  } else {
    CheckUtil.expectEqual(sm.planPrice, opt.planPrice);
  }
}

function buildListMaterialCheck(name: string, stepName: string, opt: {
  price: number;
  planPriceDate?: string | null;
  planPrice?: number | null;
}) {
  return new Action({
    name: stepName,
    url: '/app/material/listMaterialByCategory',
    method: 'POST',
    param: {
      warehouseId: '${warehouse.warehouseId}',
      warehouseGroupId: '${warehouse.warehouseGroupId}',
    }
  }, {
    check(result) {
      const material = findMaterial(result.result.content, name);
      checkSupplierMaterial(material.supplierMaterial, opt);
    }
  });
}

export default class extends TestCase {
  getName(): string {
    return '采购单价定时';
  }

  protected buildActions(): BaseTest[] {
    const today = getToday();
    const tomorrow = addDays(today, 1);
    const yesterday = addDays(today, -1);

    return [
      new PreTest(),
      new Action({
        name: `新增物料[${MATERIAL_NAME}]`,
        url: '/app/material/SaveMaterial',
        method: 'POST',
        param: {
          name: MATERIAL_NAME,
          remark: '',
          img: [],
          buyUnit: [
            { isSupplier: true, name: '斤', fee: 1 }
          ],
          suppliers: buildSuppliers(tomorrow, 20),
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        buildVariable(result) {
          return {
            lastMaterialId: result.result.materialId,
            planMaterialId: result.result.materialId,
          };
        },
        check(result) {
          if (result.result.materialId == null) {
            throw new Error('SaveMaterial 未返回 materialId');
          }
        }
      }),
      buildListMaterialCheck(MATERIAL_NAME, '查询新增物料的定时价', {
        price: 10,
        planPriceDate: tomorrow,
        planPrice: 20,
      }),
      new UpdateMaterial(MATERIAL_NAME, {
        categoryId: '${categoryMap.肉类}',
        suppliers: buildSuppliers(yesterday, 30),
      }),
      buildListMaterialCheck(MATERIAL_NAME, '查询到期后生效价', {
        price: 30,
        planPriceDate: null,
        planPrice: null,
      }),
      new UpdateMaterial(MATERIAL_NAME, {
        categoryId: '${categoryMap.肉类}',
        suppliers: buildSuppliers(tomorrow, 25, 30),
      }),
      buildListMaterialCheck(MATERIAL_NAME, '查询更新后的未来定时价', {
        price: 30,
        planPriceDate: tomorrow,
        planPrice: 25,
      }),
    ];
  }
}

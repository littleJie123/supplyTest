import { BaseTest, CheckUtil, DateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import CheckArray from "../../action/CheckArray";
import Upload from "../../action/Upload";
import path from "path";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import SaveShareData from "../../action/shareData/SaveShareData";
import ChangeWarehouse2Supplier from "../../action/user/ChangeWarehouse2Supplier";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";

const MATERIAL_NAME = '多采购单位测试';

/**
 * 多采购单位改造（见同目录 FlowMultiBuyUnit.md）。
 * 测试步骤与 doc/多采购单位改造.md 开发步骤一一对应；
 * 每完成一个开发步骤，在本类 buildActions 中追加同序号步骤。
 */
export default class extends TestCase {
  constructor() {
    super({
      remark: '多采购单位：开发步骤驱动用例，按步骤追加测试'
    })
  }

  getName(): string {
    return '多采购单位'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        remark: '前置：仓库/供应商/分类/基础物料'
      }),
      new Step1MultiUnitPersist(),
      new Step2KeepStockUnitsId(),
      new Step3SupplierMaterialHatOverride(),
      new Step4AutoMetricMinUnit(),
      new Step5ClientContract(),
      new Step6ImportBuyUnitConvert(),
      new Step7CreateNoteWithDefUnit(),
      new Step8LinkNoteStockUnitsId(),
      new Step9RegressionAndEdges(),
    ]
  }
}

/**
 * 开发步骤1：同供应商多规格持久化与 isDef
 */
class Step1MultiUnitPersist extends TestCase {
  constructor() {
    super({
      remark: '步骤1：同供应商保存克/包两规格，校验落库与切换 isDef'
    })
  }

  getName(): string {
    return '步骤1-多规格持久化'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new Action({
        remark: '新增物料：规格克+包；同供应商两行（克@10默认、包@800）',
        name: `新增物料[${MATERIAL_NAME}]`,
        url: '/app/material/SaveMaterial',
        method: 'POST',
        param: {
          name: MATERIAL_NAME,
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          suppliers: [
            {
              isDef: true,
              supplierId: '${supplierMap.供应商1}',
              price: 10,
              unitsName: '克',
              moc: 0
            },
            {
              isDef: false,
              supplierId: '${supplierMap.供应商1}',
              price: 800,
              unitsName: '包',
              moc: 0
            }
          ],
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        buildVariable(result) {
          return {
            lastMaterialId: result.result.materialId,
            multiBuyUnitMaterialId: result.result.materialId,
          };
        },
        check(result) {
          if (result.result.materialId == null) {
            throw new Error('SaveMaterial 未返回 materialId');
          }
        }
      }),

      new Action({
        remark: '校验 getMaterialInfo：同供应商两行，克@10(isDef)、包@800',
        name: '查询物料供应商规格',
        url: '/app/material/getMaterialInfo',
        method: 'POST',
        param: {
          materialId: '${multiBuyUnitMaterialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        buildVariable(result) {
          const suppliers = result.result.suppliers ?? [];
          const byUnit: any = {};
          for (const row of suppliers) {
            byUnit[row.unitsName] = row;
          }
          return {
            multiBuyUnitGramUnitsId: byUnit['克']?.stockUnitsId ?? byUnit['克']?.supplierUnitsId,
            multiBuyUnitBagUnitsId: byUnit['包']?.stockUnitsId ?? byUnit['包']?.supplierUnitsId,
          };
        },
        check(result) {
          const suppliers = result.result.suppliers ?? [];
          CheckUtil.expectEqual(suppliers.length, 2);
          const gram = suppliers.find(row => row.unitsName === '克');
          const bag = suppliers.find(row => row.unitsName === '包');
          if (gram == null || bag == null) {
            throw new Error(`期望克/包两行，实际: ${JSON.stringify(suppliers)}`);
          }
          CheckUtil.expectEqual(gram.price, 10);
          CheckUtil.expectEqual(bag.price, 800);
          CheckUtil.expectEqual(gram.isDef, 1);
          CheckUtil.expectEqual(bag.isDef, 0);
          CheckUtil.expectEqual(gram.supplierId, bag.supplierId);
          if (gram.stockUnitsId == null || gram.stockUnitsId === 0) {
            throw new Error('克规格 stockUnitsId 无效');
          }
          if (bag.stockUnitsId == null || bag.stockUnitsId === 0) {
            throw new Error('包规格 stockUnitsId 无效');
          }
          if (gram.stockUnitsId === bag.stockUnitsId) {
            throw new Error('克/包 stockUnitsId 不应相同');
          }
        }
      }),

      new Action({
        remark: '切换 isDef：包@800 为默认，克@10 非默认',
        name: `更新物料isDef[${MATERIAL_NAME}]`,
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${multiBuyUnitMaterialId}',
          name: MATERIAL_NAME,
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          suppliers: [
            {
              isDef: false,
              supplierId: '${supplierMap.供应商1}',
              price: 10,
              unitsName: '克',
              moc: 0
            },
            {
              isDef: true,
              supplierId: '${supplierMap.供应商1}',
              price: 800,
              unitsName: '包',
              moc: 0
            }
          ],
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }),

      new Action({
        remark: '校验切换 isDef 后：两行仍在；默认行为包@800',
        name: '再次查询物料供应商规格',
        url: '/app/material/getMaterialInfo',
        method: 'POST',
        param: {
          materialId: '${multiBuyUnitMaterialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        check(result) {
          const suppliers = result.result.suppliers ?? [];
          CheckUtil.expectEqual(suppliers.length, 2);
          const gram = suppliers.find(row => row.unitsName === '克');
          const bag = suppliers.find(row => row.unitsName === '包');
          if (gram == null || bag == null) {
            throw new Error(`期望克/包两行，实际: ${JSON.stringify(suppliers)}`);
          }
          CheckUtil.expectEqual(gram.isDef, 0);
          CheckUtil.expectEqual(bag.isDef, 1);
          CheckUtil.expectEqual(bag.price, 800);
          CheckUtil.expectEqual(gram.price, 10);
        }
      }),

      new Action({
        remark: 'listMaterialByCategory：默认 SM 为包@800（仅返回 isDef=1 一行）',
        name: '查询列表默认供应商物料',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          materialId: ['${multiBuyUnitMaterialId}'],
        }
      }, {
        check(result) {
          const content = result.result.content ?? [];
          const material = content.find(row => row.name === MATERIAL_NAME);
          if (material == null) {
            throw new Error(`未找到物料 ${MATERIAL_NAME}`);
          }
          const sm = material.supplierMaterial;
          if (sm == null) {
            throw new Error('缺少默认 supplierMaterial');
          }
          CheckUtil.expectEqual(sm.price, 800);
          if (sm.stockUnitsId == null || sm.stockUnitsId === 0) {
            throw new Error('默认 SM stockUnitsId 无效');
          }
        }
      }),

      new CheckArray([{
        table: 'supplierMaterial',
        query: {
          materialId: '${multiBuyUnitMaterialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 2, 'free/query supplierMaterial 应有2行');
          let gramRow = array.find(row =>
            String(row.stockUnitsId) === String(variable.multiBuyUnitGramUnitsId));
          let bagRow = array.find(row =>
            String(row.stockUnitsId) === String(variable.multiBuyUnitBagUnitsId));
          if (gramRow == null || bagRow == null) {
            gramRow = array.find(row => Number(row.price) === 10);
            bagRow = array.find(row => Number(row.price) === 800);
          }
          if (gramRow == null || bagRow == null) {
            throw new Error(`free/query 未找到克/包两行: ${JSON.stringify(array)}`);
          }
          CheckUtil.expectEqual(Number(gramRow.price), 10);
          CheckUtil.expectEqual(Number(bagRow.price), 800);
          CheckUtil.expectEqual(Number(gramRow.isDef), 0);
          CheckUtil.expectEqual(Number(bagRow.isDef), 1);
          CheckUtil.expectEqual(String(gramRow.supplierId), String(bagRow.supplierId));
          if (String(gramRow.stockUnitsId) === String(bagRow.stockUnitsId)) {
            throw new Error('两行 stockUnitsId 不应相同');
          }
        }
      }]).setRemark('free/query：库表确认同供应商两规格均在，包为 isDef'),
    ]
  }
}

/**
 * 开发步骤2：挂物料规格时保留主表有效 stockUnitsId；空/0 回退 material
 */
class Step2KeepStockUnitsId extends TestCase {
  constructor() {
    super({
      remark: '步骤2：下单带非默认单位/0，listNoteItem 校验 Hat 保留或回退'
    })
  }

  getName(): string {
    return '步骤2-Hat保留stockUnitsId'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new Action({
        remark: '下单：明细 stockUnitsId=克（非物料默认包）',
        name: 'createNote保留克单位',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${multiBuyUnitMaterialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 1,
            buyUnitFee: 1,
            stockUnitsId: '${multiBuyUnitGramUnitsId}',
            price: 10,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          return { keepUnitNoteId: notes[0]?.noteId };
        },
        check(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          if (notes[0]?.noteId == null) {
            throw new Error(`createNote 未返回 noteId: ${JSON.stringify(result.result)}`);
          }
        }
      }),

      new Action({
        remark: 'listNoteItem：应保留克单位，且 isSupplier 落在克',
        name: 'listNoteItem保留克',
        url: '/app/noteItem/listNoteItem',
        method: 'POST',
        param: {
          noteId: '${keepUnitNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        check(result) {
          const content = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 1);
          const row = content[0];
          CheckUtil.expectEqual(
            String(row.stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            'listNoteItem 应保留下单时的克 stockUnitsId'
          );
          const supplierBu = (row.buyUnit ?? []).find((bu: any) => bu.isSupplier);
          if (supplierBu == null) {
            throw new Error('未标记 isSupplier 的规格');
          }
          CheckUtil.expectEqual(
            String(supplierBu.unitsId),
            String(variable.multiBuyUnitGramUnitsId),
            'isSupplier 应落在克'
          );
        }
      }),

      new CheckArray([{
        table: 'noteItem',
        query: {
          noteId: '${keepUnitNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1);
          CheckUtil.expectEqual(
            String(array[0].stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            'free/query noteItem.stockUnitsId 应为克'
          );
        }
      }]).setRemark('free/query：库表 noteItem.stockUnitsId=克'),

      new Action({
        remark: '下单：stockUnitsId=0，查询应回退 material 采购单位（包）',
        name: 'createNote零单位回退',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${multiBuyUnitMaterialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 1,
            buyUnitFee: 1,
            stockUnitsId: 0,
            price: 800,
            stockBuyUnitFee: 100
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          return { zeroUnitNoteId: notes[0]?.noteId };
        }
      }),

      new Action({
        remark: 'listNoteItem：stockUnitsId=0 时回退为包',
        name: 'listNoteItem回退包',
        url: '/app/noteItem/listNoteItem',
        method: 'POST',
        param: {
          noteId: '${zeroUnitNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        check(result) {
          const content = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 1);
          const row = content[0];
          CheckUtil.expectEqual(
            String(row.stockUnitsId),
            String(variable.multiBuyUnitBagUnitsId),
            'stockUnitsId=0 应回退 material 采购单位包'
          );
          const supplierBu = (row.buyUnit ?? []).find((bu: any) => bu.isSupplier);
          if (supplierBu == null) {
            throw new Error('未标记 isSupplier 的规格');
          }
          CheckUtil.expectEqual(
            String(supplierBu.unitsId),
            String(variable.multiBuyUnitBagUnitsId),
            'isSupplier 应落在包'
          );
        }
      }),
    ]
  }
}

/**
 * 开发步骤3：默认 SM 单位覆盖行上 stockUnitsId（与物料默认采购单位不同时）
 */
class Step3SupplierMaterialHatOverride extends TestCase {
  constructor() {
    super({
      remark: '步骤3：isDef 切回克后，listMaterialByCategory 的 stockUnitsId/isSupplier 跟默认 SM'
    })
  }

  getName(): string {
    return '步骤3-SM覆盖单位'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new Action({
        remark: '将 isDef 切回克@10（与物料默认采购单位包不同）',
        name: `isDef切回克[${MATERIAL_NAME}]`,
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${multiBuyUnitMaterialId}',
          name: MATERIAL_NAME,
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          suppliers: [
            {
              isDef: true,
              supplierId: '${supplierMap.供应商1}',
              price: 10,
              unitsName: '克',
              moc: 0
            },
            {
              isDef: false,
              supplierId: '${supplierMap.供应商1}',
              price: 800,
              unitsName: '包',
              moc: 0
            }
          ],
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }),

      new Action({
        remark: 'listMaterialByCategory：默认 SM 为克，行上 stockUnitsId/isSupplier 应为克（非物料包）',
        name: '校验SM覆盖stockUnitsId',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          materialId: ['${multiBuyUnitMaterialId}'],
        }
      }, {
        check(result) {
          const content = result.result.content ?? [];
          const material = content.find(row => row.name === MATERIAL_NAME);
          if (material == null) {
            throw new Error(`未找到物料 ${MATERIAL_NAME}`);
          }
          const sm = material.supplierMaterial;
          if (sm == null) {
            throw new Error('缺少默认 supplierMaterial');
          }
          CheckUtil.expectEqual(sm.price, 10);
          CheckUtil.expectEqual(
            String(sm.stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            '默认 SM stockUnitsId 应为克'
          );
          CheckUtil.expectEqual(
            String(material.stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            '行上 stockUnitsId 应由 SM 覆盖为克'
          );
          const supplierBu = (material.buyUnit ?? []).find((bu: any) => bu.isSupplier);
          if (supplierBu == null) {
            throw new Error('未标记 isSupplier 的规格');
          }
          CheckUtil.expectEqual(
            String(supplierBu.unitsId),
            String(variable.multiBuyUnitGramUnitsId),
            'isSupplier 应落在克'
          );
        }
      }),

      new CheckArray([{
        table: 'supplierMaterial',
        query: {
          materialId: '${multiBuyUnitMaterialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0,
          isDef: 1
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '默认 SM 应只有1行');
          CheckUtil.expectEqual(Number(array[0].price), 10);
          CheckUtil.expectEqual(
            String(array[0].stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            'free/query 默认 SM 应为克'
          );
        }
      }]).setRemark('free/query：确认 isDef=1 为克@10'),
    ]
  }
}

/**
 * 开发步骤4：规格自动补公制最小单位 + 别名转正式名
 */
class Step4AutoMetricMinUnit extends TestCase {
  constructor() {
    super({
      remark: '步骤4：包/斤/克/g/千克 多种规格组合的自动补单位与别名转换'
    })
  }

  getName(): string {
    return '步骤4-自动补公制最小单位'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    const cases: Array<{
      key: string;
      name: string;
      buyUnit: Array<{ name: string; fee: number; isSupplier?: boolean }>;
      unitsName: string;
      expectNames: string[];
      expectFees: number[];
    }> = [
      {
        key: 'autoMinBagOnly',
        name: '补单位-仅包',
        buyUnit: [{ name: '包', fee: 1, isSupplier: true }],
        unitsName: '包',
        expectNames: ['包'],
        expectFees: [1],
      },
      {
        key: 'autoMinBag3Jin',
        name: '补单位-1包=3斤',
        buyUnit: [
          { name: '斤', fee: 1 },
          { name: '包', fee: 3, isSupplier: true },
        ],
        unitsName: '包',
        // 斤非 isMin → 补克；斤.fees/克.fees=500
        expectNames: ['克', '斤', '包'],
        expectFees: [1, 500, 3],
      },
      {
        key: 'autoMinJin3Bag',
        name: '补单位-1斤=3包',
        buyUnit: [
          { name: '包', fee: 1 },
          { name: '斤', fee: 3, isSupplier: true },
        ],
        unitsName: '斤',
        // 首项是自定义「包」，不补公制
        expectNames: ['包', '斤'],
        expectFees: [1, 3],
      },
      {
        key: 'autoMinBag100g',
        name: '补单位-1包=100g',
        buyUnit: [
          { name: 'g', fee: 1 },
          { name: '包', fee: 100, isSupplier: true },
        ],
        unitsName: '包',
        // g 别名转正式「克」，已是 isMin，不再补
        expectNames: ['克', '包'],
        expectFees: [1, 100],
      },
      {
        key: 'autoMinBag100Gram',
        name: '补单位-1包=100克',
        buyUnit: [
          { name: '克', fee: 1 },
          { name: '包', fee: 100, isSupplier: true },
        ],
        unitsName: '包',
        expectNames: ['克', '包'],
        expectFees: [1, 100],
      },
      {
        key: 'autoMinKgOnly',
        name: '补单位-仅千克',
        buyUnit: [{ name: '千克', fee: 1, isSupplier: true }],
        unitsName: '千克',
        expectNames: ['克', '千克'],
        expectFees: [1, 1000],
      },
    ];

    const actions: BaseTest[] = [];
    for (const c of cases) {
      actions.push(new Action({
        remark: `新增物料「${c.name}」：${JSON.stringify(c.buyUnit)}`,
        name: `新增[${c.name}]`,
        url: '/app/material/SaveMaterial',
        method: 'POST',
        param: {
          name: c.name,
          remark: '',
          img: [],
          buyUnit: c.buyUnit,
          suppliers: [
            {
              isDef: true,
              supplierId: '${supplierMap.供应商1}',
              price: 1,
              unitsName: c.unitsName,
              moc: 0
            }
          ],
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        buildVariable(result) {
          return {
            [c.key + 'Id']: result.result.materialId,
          };
        },
        check(result) {
          if (result.result.materialId == null) {
            throw new Error(`SaveMaterial[${c.name}] 未返回 materialId`);
          }
        }
      }));
    }

    const materialIdKeys = cases.map(c => `\${${c.key}Id}`);
    actions.push(new Action({
      remark: '按 materialId 批量查询，校验各规格补齐/别名转换结果',
      name: 'listMaterialByCategory校验补单位',
      url: '/app/material/listMaterialByCategory',
      method: 'POST',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        materialId: materialIdKeys,
      }
    }, {
      buildVariable(result) {
        const content = result.result.content ?? [];
        const kgMat = content.find((row: any) => row.name === '补单位-仅千克');
        return {
          autoMinMaterialId: kgMat?.materialId,
          autoMinBuyUnitId: kgMat?.buyUnitId,
        };
      },
      check(result) {
        const content = result.result.content ?? [];
        CheckUtil.expectEqual(
          content.length,
          cases.length,
          `应按 materialId 只返回 ${cases.length} 条，实际 ${content.length}`
        );
        for (const c of cases) {
          const material = content.find((row: any) => row.name === c.name);
          if (material == null) {
            throw new Error(`未找到物料 ${c.name}，content=${JSON.stringify(content.map((r: any) => r.name))}`);
          }
          assertBuyUnitChain(material.buyUnit, c.expectNames, c.expectFees, c.name);
          CheckUtil.expectEqual(
            String(material.unitsId),
            String(material.buyUnit[0].unitsId),
            `${c.name}: material.unitsId 应为规格最小一级`
          );
        }
      }
    }));

    actions.push(new CheckArray([{
      table: 'buyUnit',
      notWarehouseGroupId: true,
      query: {
        buyUnitId: '${autoMinBuyUnitId}',
        isDel: 0
      },
      check(array) {
        CheckUtil.expectEqual(array.length, 1);
        const bu = array[0];
        const unitsIds = String(bu.unitsIds).split(',');
        const fees = String(bu.fees).split(',');
        CheckUtil.expectEqual(unitsIds.length, 2, `仅千克 buyUnit 应为克+千克: ${bu.unitsIds}`);
        CheckUtil.expectEqual(fees[0], '1');
        CheckUtil.expectEqual(fees[1], '1000', `第二级 fee 应为1000，实际 fees=${bu.fees}`);
        if (variable.multiBuyUnitGramUnitsId != null) {
          CheckUtil.expectEqual(
            String(unitsIds[0]),
            String(variable.multiBuyUnitGramUnitsId),
            'buy_unit 首单位应为克'
          );
        }
      }
    }]).setRemark('free/query buyUnit：仅千克案例确认已补克且 fees=1,1000'));

    return actions;
  }
}

/**
 * 校验规格链名称与 fee（按顺序）
 */
function assertBuyUnitChain(
  buyUnit: any[],
  expectNames: string[],
  expectFees: number[],
  label: string
) {
  if (buyUnit == null) {
    throw new Error(`${label}: buyUnit 为空`);
  }
  CheckUtil.expectEqual(
    buyUnit.length,
    expectNames.length,
    `${label}: 规格级数应为 ${expectNames.length}，实际 ${JSON.stringify(buyUnit)}`
  );
  for (let i = 0; i < expectNames.length; i++) {
    CheckUtil.expectEqual(
      buyUnit[i].name,
      expectNames[i],
      `${label}: 第${i}级名称`
    );
    CheckUtil.expectEqual(
      Number(buyUnit[i].fee),
      expectFees[i],
      `${label}: 第${i}级 fee`
    );
  }
}

/**
 * 开发步骤5：客户端契约 — 提交体带 stockUnitsId（与 PriceByUnits / MaterialCrud 一致）
 */
class Step5ClientContract extends TestCase {
  constructor() {
    super({
      remark: '步骤5：用与 UI 相同请求体（stockUnitsId+unitsName）更新同供应商两规格'
    })
  }

  getName(): string {
    return '步骤5-客户端契约提交'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new Action({
        remark: 'UpdateMaterial：UI 契约体（显式 stockUnitsId+unitsName），克@12默认、包@850',
        name: `客户端契约更新[${MATERIAL_NAME}]`,
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${multiBuyUnitMaterialId}',
          name: MATERIAL_NAME,
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          suppliers: [
            {
              isDef: true,
              supplierId: '${supplierMap.供应商1}',
              price: 12,
              unitsName: '克',
              stockUnitsId: '${multiBuyUnitGramUnitsId}',
              moc: 0
            },
            {
              isDef: false,
              supplierId: '${supplierMap.供应商1}',
              price: 850,
              unitsName: '包',
              stockUnitsId: '${multiBuyUnitBagUnitsId}',
              moc: 0
            }
          ],
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }),

      new Action({
        remark: 'getMaterialInfo：两行单位/价格与 UI 提交一致，克为默认',
        name: '校验客户端契约更新结果',
        url: '/app/material/getMaterialInfo',
        method: 'POST',
        param: {
          materialId: '${multiBuyUnitMaterialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        check(result) {
          const suppliers = result.result.suppliers ?? [];
          CheckUtil.expectEqual(suppliers.length, 2, '同供应商应仍为两行');
          const gram = suppliers.find((row: any) => row.unitsName === '克'
            || String(row.stockUnitsId) === String(variable.multiBuyUnitGramUnitsId));
          const bag = suppliers.find((row: any) => row.unitsName === '包'
            || String(row.stockUnitsId) === String(variable.multiBuyUnitBagUnitsId));
          if (gram == null || bag == null) {
            throw new Error(`期望克/包两行，实际: ${JSON.stringify(suppliers)}`);
          }
          CheckUtil.expectEqual(Number(gram.price), 12);
          CheckUtil.expectEqual(Number(bag.price), 850);
          CheckUtil.expectEqual(Number(gram.isDef), 1);
          CheckUtil.expectEqual(Number(bag.isDef), 0);
          CheckUtil.expectEqual(
            String(gram.stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            '克行 stockUnitsId 应与 UI 提交一致'
          );
          CheckUtil.expectEqual(
            String(bag.stockUnitsId),
            String(variable.multiBuyUnitBagUnitsId),
            '包行 stockUnitsId 应与 UI 提交一致'
          );
        }
      }),

      new CheckArray([{
        table: 'supplierMaterial',
        query: {
          materialId: '${multiBuyUnitMaterialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 2, '契约更新后仍应为2行（非重复插入）');
          const gramRow = array.find(row =>
            String(row.stockUnitsId) === String(variable.multiBuyUnitGramUnitsId));
          const bagRow = array.find(row =>
            String(row.stockUnitsId) === String(variable.multiBuyUnitBagUnitsId));
          if (gramRow == null || bagRow == null) {
            throw new Error(`free/query 未找到克/包两行: ${JSON.stringify(array)}`);
          }
          CheckUtil.expectEqual(Number(gramRow.price), 12);
          CheckUtil.expectEqual(Number(bagRow.price), 850);
          CheckUtil.expectEqual(Number(gramRow.isDef), 1);
          CheckUtil.expectEqual(Number(bagRow.isDef), 0);
        }
      }]).setRemark('free/query：UI 契约提交后同供应商两单位仍各一行'),
    ]
  }
}

/**
 * 开发步骤6：Excel 上传物料 — 别名转正式 + 自动补最小单位（与 Save 期望一致）
 */
class Step6ImportBuyUnitConvert extends TestCase {
  constructor() {
    super({
      remark: '步骤6：上传 excel/buyUnit/补单位导入.xlsx，校验规格转换与步骤4一致'
    })
  }

  getName(): string {
    return '步骤6-物料导入单位转换'
  }

  protected buildActions(): BaseTest[] {
    const cases: Array<{
      name: string;
      expectNames: string[];
      expectFees: number[];
    }> = [
      { name: '导入补单位-仅包', expectNames: ['包'], expectFees: [1] },
      { name: '导入补单位-1包=3斤', expectNames: ['克', '斤', '包'], expectFees: [1, 500, 3] },
      { name: '导入补单位-1斤=3包', expectNames: ['包', '斤'], expectFees: [1, 3] },
      { name: '导入补单位-1包=100g', expectNames: ['克', '包'], expectFees: [1, 100] },
      { name: '导入补单位-1包=100克', expectNames: ['克', '包'], expectFees: [1, 100] },
      { name: '导入补单位-仅千克', expectNames: ['克', '千克'], expectFees: [1, 1000] },
    ];

    return [
      new Upload({
        remark: '上传补单位导入.xlsx（表头同 FlowUpload 物料模板）',
        name: '上传补单位物料',
        param: {
          target: 'material',
          warehouseId: '${warehouse.warehouseId}',
        },
        filePath: path.join(__dirname, '../../../excel/buyUnit/补单位导入.xlsx')
      }, {
        check(result) {
          const importResult = result.result?.importResult;
          if (importResult != null && importResult.checked === false) {
            throw new Error(`物料上传失败: ${JSON.stringify(importResult.errors ?? importResult)}`);
          }
        }
      }),

      new Action({
        remark: 'listMaterialByCategory 按名称校验导入规格',
        name: 'listMaterialByCategory校验导入规格',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        buildVariable(result) {
          const content = result.result.content ?? [];
          const ids = cases
            .map((c) => content.find((row: any) => row.name === c.name)?.materialId)
            .filter((id) => id != null);
          return { importBuyUnitMaterialIds: ids };
        },
        check(result) {
          const content = result.result.content ?? [];
          for (const c of cases) {
            const material = content.find((row: any) => row.name === c.name);
            if (material == null) {
              throw new Error(`上传后未找到物料 ${c.name}`);
            }
            assertBuyUnitChain(material.buyUnit, c.expectNames, c.expectFees, `上传.${c.name}`);
          }
        }
      }),

      new Action({
        remark: '再按 materialId 精确查询，避免其它物料干扰',
        name: 'listMaterialByCategory按materialId复核',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          materialId: '${importBuyUnitMaterialIds}',
        }
      }, {
        check(result) {
          const content = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, cases.length, `应按 materialId 返回 ${cases.length} 条`);
          for (const c of cases) {
            const material = content.find((row: any) => row.name === c.name);
            if (material == null) {
              throw new Error(`materialId 查询未找到 ${c.name}`);
            }
            assertBuyUnitChain(material.buyUnit, c.expectNames, c.expectFees, `复核.${c.name}`);
          }
        }
      }),
    ]
  }
}

/**
 * 开发步骤7：下单写入默认 SM 的 stockUnitsId；历史查询不丢明细单位
 */
class Step7CreateNoteWithDefUnit extends TestCase {
  constructor() {
    super({
      remark: '步骤7：按 isDef 默认单位下单，listNoteItem / listNoteItemHis 保留明细单位'
    })
  }

  getName(): string {
    return '步骤7-下单写入默认单位'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    const today = DateUtil.todayStr();
    return [
      new Action({
        remark: '将 isDef 切为包@850，模拟 UI 改默认采购单位',
        name: `步骤7-isDef切包[${MATERIAL_NAME}]`,
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${multiBuyUnitMaterialId}',
          name: MATERIAL_NAME,
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          suppliers: [
            {
              isDef: false,
              supplierId: '${supplierMap.供应商1}',
              price: 12,
              unitsName: '克',
              stockUnitsId: '${multiBuyUnitGramUnitsId}',
              moc: 0
            },
            {
              isDef: true,
              supplierId: '${supplierMap.供应商1}',
              price: 850,
              unitsName: '包',
              stockUnitsId: '${multiBuyUnitBagUnitsId}',
              moc: 0
            }
          ],
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }),

      new Action({
        remark: 'listMaterialByCategory：取默认 SM 的 stockUnitsId/价（客户端下单来源）',
        name: '步骤7-读默认包单位',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          materialId: ['${multiBuyUnitMaterialId}'],
        }
      }, {
        buildVariable(result) {
          const material = (result.result.content ?? []).find((row: any) => row.name === MATERIAL_NAME);
          return {
            step7BagStockUnitsId: material?.stockUnitsId,
            step7BagPrice: material?.supplierMaterial?.price ?? material?.price,
            step7BagBuyUnitFee: material?.supplierMaterial?.buyUnitFee ?? 100,
          };
        },
        check(result) {
          const material = (result.result.content ?? []).find((row: any) => row.name === MATERIAL_NAME);
          if (material == null) {
            throw new Error(`未找到物料 ${MATERIAL_NAME}`);
          }
          CheckUtil.expectEqual(
            String(material.stockUnitsId),
            String(variable.multiBuyUnitBagUnitsId),
            '默认 SM 应为包单位'
          );
          CheckUtil.expectEqual(Number(material.supplierMaterial?.price ?? material.price), 850);
        }
      }),

      new Action({
        remark: 'createNote：提交 list 上的默认包 stockUnitsId（等同客户端去掉硬编码 0）',
        name: '步骤7-createNote包单位',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${multiBuyUnitMaterialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 1,
            buyUnitFee: 100,
            stockUnitsId: '${step7BagStockUnitsId}',
            price: '${step7BagPrice}',
            stockBuyUnitFee: '${step7BagBuyUnitFee}'
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          return { step7BagNoteId: notes[0]?.noteId };
        },
        check(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          if (notes[0]?.noteId == null) {
            throw new Error(`createNote 未返回 noteId: ${JSON.stringify(result.result)}`);
          }
        }
      }),

      new Action({
        remark: 'listNoteItem：明细应为包单位与对应价',
        name: '步骤7-listNoteItem包',
        url: '/app/noteItem/listNoteItem',
        method: 'POST',
        param: {
          noteId: '${step7BagNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        check(result) {
          const content = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 1);
          const row = content[0];
          CheckUtil.expectEqual(
            String(row.stockUnitsId),
            String(variable.multiBuyUnitBagUnitsId),
            'listNoteItem 应为包 stockUnitsId'
          );
          const supplierBu = (row.buyUnit ?? []).find((bu: any) => bu.isSupplier);
          if (supplierBu == null) {
            throw new Error('未标记 isSupplier 的规格');
          }
          CheckUtil.expectEqual(
            String(supplierBu.unitsId),
            String(variable.multiBuyUnitBagUnitsId),
            'isSupplier 应落在包'
          );
        }
      }),

      new CheckArray([{
        table: 'noteItem',
        query: {
          noteId: '${step7BagNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1);
          const row = array[0];
          if (row.stockUnitsId == null || Number(row.stockUnitsId) === 0) {
            throw new Error(`库表 noteItem 未写入 stockUnitsId: ${JSON.stringify(row)}`);
          }
          CheckUtil.expectEqual(
            String(row.stockUnitsId),
            String(variable.multiBuyUnitBagUnitsId),
            '库表 noteItem.stockUnitsId 应为包'
          );
        }
      }]).setRemark('free/query：包单位订单 noteItem.stockUnitsId 落库'),

      new Action({
        remark: '将 isDef 切回克@12，再按默认单位下单',
        name: `步骤7-isDef切克[${MATERIAL_NAME}]`,
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${multiBuyUnitMaterialId}',
          name: MATERIAL_NAME,
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          suppliers: [
            {
              isDef: true,
              supplierId: '${supplierMap.供应商1}',
              price: 12,
              unitsName: '克',
              stockUnitsId: '${multiBuyUnitGramUnitsId}',
              moc: 0
            },
            {
              isDef: false,
              supplierId: '${supplierMap.供应商1}',
              price: 850,
              unitsName: '包',
              stockUnitsId: '${multiBuyUnitBagUnitsId}',
              moc: 0
            }
          ],
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }),

      new Action({
        remark: 'listMaterialByCategory：取默认克单位后下单',
        name: '步骤7-读默认克单位',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          materialId: ['${multiBuyUnitMaterialId}'],
        }
      }, {
        buildVariable(result) {
          const material = (result.result.content ?? []).find((row: any) => row.name === MATERIAL_NAME);
          return {
            step7GramStockUnitsId: material?.stockUnitsId,
            step7GramPrice: material?.supplierMaterial?.price ?? material?.price,
            step7GramBuyUnitFee: material?.supplierMaterial?.buyUnitFee ?? 1,
          };
        },
        check(result) {
          const material = (result.result.content ?? []).find((row: any) => row.name === MATERIAL_NAME);
          if (material == null) {
            throw new Error(`未找到物料 ${MATERIAL_NAME}`);
          }
          CheckUtil.expectEqual(
            String(material.stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            '默认 SM 应为克单位'
          );
        }
      }),

      new Action({
        remark: 'createNote：提交默认克 stockUnitsId',
        name: '步骤7-createNote克单位',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${multiBuyUnitMaterialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 1,
            buyUnitFee: 1,
            stockUnitsId: '${step7GramStockUnitsId}',
            price: '${step7GramPrice}',
            stockBuyUnitFee: '${step7GramBuyUnitFee}'
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          return { step7GramNoteId: notes[0]?.noteId };
        },
        check(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          if (notes[0]?.noteId == null) {
            throw new Error(`createNote 未返回 noteId: ${JSON.stringify(result.result)}`);
          }
        }
      }),

      new CheckArray([{
        table: 'noteItem',
        query: {
          noteId: '${step7GramNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1);
          const row = array[0];
          if (row.stockUnitsId == null || Number(row.stockUnitsId) === 0) {
            throw new Error(`库表 noteItem 未写入 stockUnitsId: ${JSON.stringify(row)}`);
          }
          CheckUtil.expectEqual(
            String(row.stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            '库表 noteItem.stockUnitsId 应为克'
          );
        }
      }]).setRemark('free/query：克单位订单 noteItem.stockUnitsId 落库'),

      new Action({
        remark: 'listNoteItemHis：同物料按 materialId+supplierId 合并，stockUnitsId 取合并组内任意一个即可',
        name: '步骤7-listNoteItemHis合并',
        url: '/app/noteItem/listNoteItemHis',
        method: 'POST',
        param: {
          day: today,
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          pageSize: 500,
        }
      }, {
        check(result) {
          const content = result.result.content ?? [];
          const rows = content.filter((row: any) =>
            String(row.materialId) === String(variable.multiBuyUnitMaterialId));
          CheckUtil.expectEqual(rows.length, 1, '同物料同供应商应合并为 1 行');
          const row = rows[0];
          const unitOk = [
            String(variable.multiBuyUnitBagUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
          ].includes(String(row.stockUnitsId));
          if (!unitOk) {
            throw new Error(
              `合并后 stockUnitsId 应取包/克之一，实际=${row.stockUnitsId}`
            );
          }
        }
      }),
    ]
  }
}

/**
 * 开发步骤8：链接单明细拷贝餐厅 stockUnitsId；sync 不再把链接 SM 单位清零
 */
class Step8LinkNoteStockUnitsId extends TestCase {
  constructor() {
    super({
      remark: '步骤8：分享接单后校验链接明细单位=餐厅侧，sync 后链接 SM 单位非 0'
    })
  }

  getName(): string {
    return '步骤8-链接单拷贝单位'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new AddWarehouse({
        name: '多单位链接供应商仓',
        variableType: 'supplierWarehouse',
        type: 'supplier'
      }),

      new Action({
        remark: '下单：克单位（与当前 isDef 一致），供首次分享接单',
        name: '步骤8-createNote克',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${multiBuyUnitMaterialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 1,
            buyUnitFee: 1,
            stockUnitsId: '${multiBuyUnitGramUnitsId}',
            price: 12,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          return { step8StoreNoteId: notes[0]?.noteId };
        },
        check(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          if (notes[0]?.noteId == null) {
            throw new Error(`createNote 未返回 noteId: ${JSON.stringify(result.result)}`);
          }
        }
      }),

      new SaveShareData({
        data: { noteId: '${step8StoreNoteId}' }
      }),

      new Action({
        remark: '查询分享单',
        name: '步骤8-shareNote',
        url: '/share/shareNote',
        param: {
          shareDataNo: '${shareDataNo}',
          usersId: '${usersId}',
        }
      }),

      new ChangeWarehouse2Supplier(),

      new Action({
        remark: '供应商接单（首次建立链接）',
        name: '步骤8-linkNote',
        url: '/app/note/linkNote',
        method: 'POST',
        param: {
          warehouseId: '${supplierWarehouse.warehouseId}',
          _shareDataNo: '${shareDataNo}',
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),

      new ChangeWarehouse(),

      new Action({
        remark: '餐厅单：记录 linkNoteId / linkNoteItemId，确认本方为克',
        name: '步骤8-餐厅明细',
        url: '/app/noteItem/listNoteItem',
        method: 'POST',
        param: {
          noteId: '${step8StoreNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        buildVariable(result) {
          const row = (result.result.content ?? [])[0];
          return {
            step8LinkNoteItemId: row?.linkNoteItemId,
            step8StoreStockUnitsId: row?.stockUnitsId,
          };
        },
        check(result) {
          const content = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 1);
          const row = content[0];
          CheckUtil.expectEqual(
            String(row.stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            '餐厅明细应为克'
          );
          if (row.linkNoteItemId == null || row.linkNoteItemId === 0) {
            throw new Error('餐厅明细缺少 linkNoteItemId');
          }
        }
      }),

      new Action({
        remark: '餐厅单：记录 linkNoteId',
        name: '步骤8-餐厅单linkNoteId',
        url: '/app/note/listNote',
        method: 'POST',
        param: {
          noteId: '${step8StoreNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        buildVariable(result) {
          const row = (result.result.content ?? [])[0];
          return { step8LinkNoteId: row?.linkNoteId };
        },
        check(result) {
          const row = (result.result.content ?? [])[0];
          if (row?.linkNoteId == null || row.linkNoteId === 0) {
            throw new Error('餐厅单缺少 linkNoteId');
          }
        }
      }),

      new Action({
        remark: '链接明细：stockUnitsId 应与餐厅侧一致（克）',
        name: '步骤8-链接明细单位',
        url: '/app/noteItem/listNoteItem',
        method: 'POST',
        param: {
          noteItemId: '${step8LinkNoteItemId}',
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}',
        }
      }, {
        warehouseType: 'supplierWarehouse',
        check(result) {
          const content = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 1);
          const row = content[0];
          CheckUtil.expectEqual(
            String(row.stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            '链接明细应拷贝餐厅侧克 stockUnitsId'
          );
          CheckUtil.expectEqual(
            String(row.stockUnitsId),
            String(variable.step8StoreStockUnitsId),
            '链接明细 stockUnitsId 应等于餐厅明细'
          );
        }
      }),

      new CheckArray([{
        table: 'noteItem',
        query: {
          noteItemId: '${step8LinkNoteItemId}',
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}',
          isDel: 0
        },
        notWarehouseGroupId: true,
        check(array) {
          CheckUtil.expectEqual(array.length, 1);
          CheckUtil.expectEqual(
            String(array[0].stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            '库表链接 noteItem.stockUnitsId 应为克'
          );
        }
      }]).setRemark('free/query：链接 noteItem.stockUnitsId=克'),

      new Action({
        remark: '取餐厅克规格 SM 的 linkSupplierMaterialId',
        name: '步骤8-查餐厅SM链接',
        url: '/free/query',
        method: 'POST',
        param: {
          array: [{
            table: 'supplierMaterial',
            query: {
              materialId: '${multiBuyUnitMaterialId}',
              supplierId: '${supplierMap.供应商1}',
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        buildVariable(result) {
          const sms = result.result?.supplierMaterial ?? [];
          const gram = sms.find((row: any) =>
            String(row.stockUnitsId) === String(variable.multiBuyUnitGramUnitsId));
          return {
            step8LinkSmId: gram?.linkSupplierMaterialId,
            step8StoreSmId: gram?.supplierMaterialId,
          };
        },
        check(result) {
          const sms = result.result?.supplierMaterial ?? [];
          const gram = sms.find((row: any) =>
            String(row.stockUnitsId) === String(variable.multiBuyUnitGramUnitsId));
          if (gram == null) {
            throw new Error('未找到餐厅克规格 supplierMaterial');
          }
          if (gram.linkSupplierMaterialId == null || gram.linkSupplierMaterialId === 0) {
            const linked = sms.filter((row: any) =>
              row.linkSupplierMaterialId != null && Number(row.linkSupplierMaterialId) !== 0);
            throw new Error(
              `餐厅克规格(isDef) SM 缺少 linkSupplierMaterialId；同物料已链接行=${JSON.stringify(linked.map((r: any) => ({ id: r.supplierMaterialId, stockUnitsId: r.stockUnitsId, isDef: r.isDef, link: r.linkSupplierMaterialId })))}`
            );
          }
        }
      }),

      new Action({
        remark: 'updateMaterial 改价触发 sync（校验链接 SM 单位不被清零）',
        name: `步骤8-update触发sync[${MATERIAL_NAME}]`,
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${multiBuyUnitMaterialId}',
          name: MATERIAL_NAME,
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          suppliers: [
            {
              isDef: true,
              supplierId: '${supplierMap.供应商1}',
              price: 13,
              unitsName: '克',
              stockUnitsId: '${multiBuyUnitGramUnitsId}',
              moc: 0
            },
            {
              isDef: false,
              supplierId: '${supplierMap.供应商1}',
              price: 850,
              unitsName: '包',
              stockUnitsId: '${multiBuyUnitBagUnitsId}',
              moc: 0
            }
          ],
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }),

      new Action({
        remark: '链接 SM：sync 后 stockUnitsId 应为餐厅克单位，非 0',
        name: '步骤8-校验链接SM单位',
        url: '/free/query',
        method: 'POST',
        param: {
          array: [{
            table: 'supplierMaterial',
            query: {
              supplierMaterialId: '${step8LinkSmId}',
              warehouseGroupId: '${supplierWarehouse.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        check(result) {
          const sms = result.result?.supplierMaterial ?? [];
          CheckUtil.expectEqual(sms.length, 1, '应查到链接 supplierMaterial');
          const linkSm = sms[0];
          if (linkSm.stockUnitsId == null || Number(linkSm.stockUnitsId) === 0) {
            throw new Error(`链接 SM stockUnitsId 被清零: ${JSON.stringify(linkSm)}`);
          }
          CheckUtil.expectEqual(
            String(linkSm.stockUnitsId),
            String(variable.multiBuyUnitGramUnitsId),
            'sync 后链接 SM 应为餐厅克 stockUnitsId'
          );
        }
      }),
    ]
  }
}

/**
 * 开发步骤9：全流程回归 + 边角说明（未做项见 md 注意点）
 */
class Step9RegressionAndEdges extends TestCase {
  constructor() {
    super({
      remark: '步骤9：串跑校验多规格 SM / 默认单位下单落库；边角未做项仅文档标注'
    })
  }

  getName(): string {
    return '步骤9-全流程回归'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new Action({
        remark: '回归：getMaterialInfo 同供应商仍为克/包两行',
        name: '步骤9-getMaterialInfo回归',
        url: '/app/material/getMaterialInfo',
        method: 'POST',
        param: {
          materialId: '${multiBuyUnitMaterialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        check(result) {
          const suppliers = result.result.suppliers ?? [];
          CheckUtil.expectEqual(suppliers.length, 2, '同供应商应仍为两规格');
          const gram = suppliers.find((row: any) =>
            String(row.stockUnitsId) === String(variable.multiBuyUnitGramUnitsId));
          const bag = suppliers.find((row: any) =>
            String(row.stockUnitsId) === String(variable.multiBuyUnitBagUnitsId));
          if (gram == null || bag == null) {
            throw new Error(`回归未找到克/包两行: ${JSON.stringify(suppliers)}`);
          }
        }
      }),

      new Action({
        remark: '回归：listMaterialByCategory 默认 SM 单位非 0',
        name: '步骤9-list默认单位',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          materialId: ['${multiBuyUnitMaterialId}'],
        }
      }, {
        buildVariable(result) {
          const material = (result.result.content ?? []).find((row: any) => row.name === MATERIAL_NAME);
          return {
            step9DefStockUnitsId: material?.stockUnitsId,
            step9DefPrice: material?.supplierMaterial?.price ?? material?.price,
            step9DefBuyUnitFee: material?.supplierMaterial?.buyUnitFee ?? 1,
          };
        },
        check(result) {
          const material = (result.result.content ?? []).find((row: any) => row.name === MATERIAL_NAME);
          if (material == null) {
            throw new Error(`未找到物料 ${MATERIAL_NAME}`);
          }
          if (material.stockUnitsId == null || Number(material.stockUnitsId) === 0) {
            throw new Error(`默认 SM stockUnitsId 无效: ${JSON.stringify(material.supplierMaterial)}`);
          }
        }
      }),

      new Action({
        remark: '回归：按默认单位 createNote',
        name: '步骤9-createNote默认单位',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${multiBuyUnitMaterialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 1,
            buyUnitFee: '${step9DefBuyUnitFee}',
            stockUnitsId: '${step9DefStockUnitsId}',
            price: '${step9DefPrice}',
            stockBuyUnitFee: '${step9DefBuyUnitFee}'
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          return { step9NoteId: notes[0]?.noteId };
        },
        check(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          if (notes[0]?.noteId == null) {
            throw new Error(`createNote 未返回 noteId: ${JSON.stringify(result.result)}`);
          }
        }
      }),

      new CheckArray([{
        table: 'noteItem',
        query: {
          noteId: '${step9NoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1);
          const row = array[0];
          if (row.stockUnitsId == null || Number(row.stockUnitsId) === 0) {
            throw new Error(`回归 noteItem 未写入 stockUnitsId: ${JSON.stringify(row)}`);
          }
          CheckUtil.expectEqual(
            String(row.stockUnitsId),
            String(variable.step9DefStockUnitsId),
            '回归 noteItem.stockUnitsId 应等于下单默认单位'
          );
        }
      }]).setRemark('free/query：步骤9 下单 noteItem.stockUnitsId 落库'),

      new CheckArray([{
        table: 'supplierMaterial',
        query: {
          materialId: '${multiBuyUnitMaterialId}',
          supplierId: '${supplierMap.供应商1}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 2, '回归库表同供应商仍两规格');
          const zeroUnit = array.filter((row: any) =>
            row.stockUnitsId == null || Number(row.stockUnitsId) === 0);
          if (zeroUnit.length > 0) {
            throw new Error(`回归仍有 stockUnitsId=0 的 SM: ${JSON.stringify(zeroUnit)}`);
          }
        }
      }]).setRemark('free/query：步骤9 同供应商两规格 stockUnitsId 均有效'),
    ]
  }
}

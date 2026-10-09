import { ArrayUtil, BaseTest, CheckUtil, HttpAction, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import Action from "../../action/Action";
import QueryAction from "../../action/QueryAction";
import SaveShareData from "../../action/shareData/SaveShareData";
import ProcessNote from "../../action/note/ProcessNote";
import CheckArray from "../../action/CheckArray";
import StockUtil from "../../util/StockUtil";
import MaterialLinkUtil from "../../util/MaterialLinkUtil";
import IOpt from "../../inf/IOpt";

const STORE_NAME = '测试门店';
const SUPPLIER_NAME = '测试供应商';

interface OrderItemDef {
  name: string;
  cnt: number;
  unit: string;
  price: number;
}

interface StoreDef {
  key: 'storeA' | 'storeB' | 'storeC';
  title: string;
  bananaUnit: string;
  grapeUnit: string;
  items: OrderItemDef[];
}

const STORES: StoreDef[] = [
  {
    key: 'storeA',
    title: '门店A',
    bananaUnit: '瓶',
    grapeUnit: '斤',
    items: [
      { name: '香蕉', cnt: 5, unit: '瓶', price: 10 },
      { name: '苹果', cnt: 10, unit: '袋', price: 2 },
      { name: '西瓜', cnt: 15, unit: '包', price: 3 },
      { name: '葡萄', cnt: 20, unit: '斤', price: 1 }
    ]
  },
  {
    key: 'storeB',
    title: '门店B',
    bananaUnit: '箱',
    grapeUnit: '公斤',
    items: [
      { name: '香蕉', cnt: 5, unit: '箱', price: 10 },
      { name: '苹果', cnt: 10, unit: '袋', price: 2 },
      { name: '西瓜', cnt: 15, unit: '包', price: 3 },
      { name: '葡萄', cnt: 20, unit: '公斤', price: 1 }
    ]
  },
  {
    key: 'storeC',
    title: '门店C',
    bananaUnit: '袋',
    grapeUnit: '千克',
    items: [
      { name: '香蕉', cnt: 5, unit: '袋', price: 10 },
      { name: '苹果', cnt: 10, unit: '袋', price: 2 },
      { name: '西瓜', cnt: 15, unit: '包', price: 3 },
      { name: '葡萄', cnt: 15, unit: '千克', price: 1 }
    ]
  }
];

function findUnit(buyUnit: any[], name: string) {
  const aliases: { [key: string]: string[] } = {
    '公斤': ['公斤', '千克', 'kg'],
    '千克': ['千克', '公斤', 'kg'],
    '斤': ['斤'],
    '克': ['克', 'g'],
    '包': ['包'],
    '瓶': ['瓶'],
    '箱': ['箱'],
    '袋': ['袋']
  };
  const names = aliases[name] ?? [name];
  return (buyUnit ?? []).find((row: any) => names.includes(row.name));
}

function unitBuyUnitFee(material: any, unit: any): number {
  if (unit == null) {
    throw new Error(`物料${material?.name}找不到下单单位`);
  }
  if (String(material.unitsId) === String(unit.unitsId)) {
    return 1;
  }
  const buyUnit: any[] = material.buyUnit ?? [];
  const ids = buyUnit.map((row: any) => row.unitsId);
  const fees = buyUnit.map((row: any) => Number(row.fee) || 1);
  let stdIdx = ids.findIndex((id: any) => String(id) === String(material.unitsId));
  let unitIdx = ids.findIndex((id: any) => String(id) === String(unit.unitsId));
  if (stdIdx < 0) {
    stdIdx = 0;
  }
  if (unitIdx < 0) {
    throw new Error(`物料${material?.name}规格中无单位${unit.name}`);
  }
  if (stdIdx === unitIdx) {
    return 1;
  }
  let fee = 1;
  if (unitIdx > stdIdx) {
    for (let i = stdIdx + 1; i <= unitIdx; i++) {
      fee *= fees[i];
    }
    return -fee;
  }
  for (let i = unitIdx + 1; i <= stdIdx; i++) {
    fee *= fees[i];
  }
  return fee;
}

function hasName(names: string[], name: string) {
  return names.includes(name);
}

/** 盘点在订货合计之上再加的数量，保证发货扣减后库存仍大于 0 */
const INIT_EXTRA = 100;

function readStock(value: any, buyUnitFee?: number): { cnt: number; buyUnitFee: number } {
  if (value != null && typeof value === 'object') {
    return {
      cnt: Number(value.cnt ?? 0),
      buyUnitFee: Number(value.buyUnitFee ?? buyUnitFee ?? 1)
    };
  }
  return {
    cnt: Number(value ?? 0),
    buyUnitFee: Number(buyUnitFee ?? 1)
  };
}

function sumStocks(list: { cnt: number; buyUnitFee: number }[]) {
  if (list.length === 0) {
    return { cnt: 0, buyUnitFee: 1 };
  }
  const min = StockUtil.selectMinBuyUnitFeeStockCnt(...list);
  let cnt = 0;
  for (const row of list) {
    cnt += StockUtil.calCntWithFee(row, min);
  }
  return { cnt, buyUnitFee: min.buyUnitFee };
}

function minusStock(
  left: { cnt: number; buyUnitFee: number },
  right: { cnt: number; buyUnitFee: number }
) {
  const min = StockUtil.selectMinBuyUnitFeeStockCnt(left, right);
  return {
    cnt: StockUtil.calCntWithFee(left, min) - StockUtil.calCntWithFee(right, min),
    buyUnitFee: min.buyUnitFee
  };
}

function orderStock(row: any) {
  if (row?.purcharse != null) {
    return readStock(row.purcharse);
  }
  return readStock(row?.cnt, row?.buyUnitFee);
}

/** 盘点记在昨天日终，保证早于今天的发货流水 */
function inventoryDay() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function buildSupplierInit(variable: any) {
  const items = ['storeA', 'storeB', 'storeC'].flatMap(
    key => variable[`${key}SupplierNoteItems`] ?? []
  );
  const groups = new Map<string, any[]>();
  for (const item of items) {
    const id = String(item.materialId);
    const list = groups.get(id) ?? [];
    list.push(item);
    groups.set(id, list);
  }
  const array: any[] = [];
  const initStock: any = {};
  for (const [materialId, rows] of groups) {
    const ordered = sumStocks(rows.map(row => orderStock(row)));
    const init = { cnt: ordered.cnt + INIT_EXTRA, buyUnitFee: ordered.buyUnitFee };
    array.push({
      materialId: Number(materialId),
      cnt: init.cnt,
      buyUnitFee: init.buyUnitFee,
      cost: 0
    });
    initStock[materialId] = {
      name: rows[0].name,
      cnt: init.cnt,
      buyUnitFee: init.buyUnitFee
    };
  }
  return { array, initStock };
}

class ChangeToWarehouse extends Action {
  constructor(targetKey: string, title?: string) {
    super({
      name: title ?? `切换仓库:${targetKey}`,
      url: '/app/warehouseGroup/changeWarehouse',
      param: {
        warehouse: {
          warehouseGroupId: `\${${targetKey}.warehouseGroupId}`,
          warehouseId: `\${${targetKey}.warehouseId}`
        },
        warehouseGroupId: `\${${targetKey}.warehouseGroupId}`
      },
      headers: {
        token: '${token}'
      }
    }, {
      check(result) {
        CheckUtil.expectNotNull(result.result?.token);
      },
      buildVariable(result) {
        return {
          token: result.result?.token.token
        };
      }
    });
  }
}

class CreateStoreNote extends HttpAction {
  private storeKey: string;
  private orderItems: OrderItemDef[];

  constructor(store: StoreDef) {
    super({
      name: `${store.title}下单`,
      url: '/app/note/createNote',
      method: 'POST',
      param: {}
    });
    this.storeKey = store.key;
    this.orderItems = store.items;
  }

  protected parseHttpParam() {
    const variable = this.getVariable();
    const store = variable[this.storeKey];
    const materials = variable[`${this.storeKey}Materials`];
    const supplierId = variable[`${this.storeKey}SupplierId`];
    const items = this.orderItems.map(def => {
      const material = materials[def.name];
      if (material == null) {
        throw new Error(`${this.storeKey}未找到物料${def.name}`);
      }
      const unit = findUnit(material.buyUnit, def.unit);
      const buyUnitFee = unitBuyUnitFee(material, unit);
      return {
        materialId: material.materialId,
        supplierId,
        cnt: def.cnt,
        buyUnitFee,
        stockUnitsId: unit?.unitsId ?? material.stockUnitsId,
        price: def.price,
        stockBuyUnitFee: buyUnitFee
      };
    });
    return {
      warehouseId: store.warehouseId,
      warehouseGroupId: store.warehouseGroupId,
      items
    };
  }

  protected buildVariable(result: any) {
    const notes = Array.isArray(result.result) ? result.result : [];
    return {
      [`${this.storeKey}NoteId`]: notes[0]?.noteId,
      [`${this.storeKey}NoteIds`]: ArrayUtil.toArray(notes, 'noteId')
    };
  }

  protected async checkResult(result: any): Promise<void> {
    const notes = Array.isArray(result.result) ? result.result : [];
    if (notes[0]?.noteId == null) {
      throw new Error(`${this.storeKey} createNote 未返回 noteId: ${JSON.stringify(result.result)}`);
    }
  }
}

/**
 * 三家同名门店向同一供应商发单接单：物料匹配、门店名唯一、出库后 linkInstockCnt 从关联明细组装。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '三家同名门店向同一供应商发单，校验物料匹配、门店列表与 linkInstockCnt' });
  }

  getName(): string {
    return '供应商接单流程';
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      ...this.buildSupplier(),
      ...this.buildStore(STORES[0]),
      ...this.buildStore(STORES[1]),
      ...this.buildStore(STORES[2]),
      ...this.buildLink(STORES[0]),
      ...this.buildLink(STORES[1]),
      ...this.buildLink(STORES[2]),
      ...this.buildVerify(),
      ...this.buildSupplierOut(),
      this.buildCheckSupplierStock(),
      ...this.buildCheckLinkInstock(STORES[0]),
      ...this.buildCheckLinkInstock(STORES[1]),
      ...this.buildCheckLinkInstock(STORES[2]),
      ...this.buildRenameStores()
    ];
  }

  private buildSupplier(): BaseTest[] {
    return [
      new AddWarehouse({
        name: SUPPLIER_NAME,
        type: 'supplier',
        variableType: 'supplierWarehouse'
      }).setRemark('创建供应商账号'),
      new ChangeToWarehouse('supplierWarehouse', '切换到供应商仓'),
      new Action({
        name: '供应商新增分类',
        url: '/app/category/addCategory',
        param: {
          name: '水果',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          return { supplierCategoryId: result.result.categoryId };
        }
      }),
      this.saveMaterial('supplierWarehouse', '香蕉', [
        { name: '包', fee: 1, isSupplier: true }
      ], 'supplierCategoryId'),
      this.saveMaterial('supplierWarehouse', '苹果', [
        { name: '斤', fee: 1 },
        { name: '包', fee: 10, isSupplier: true }
      ], 'supplierCategoryId'),
      this.saveMaterial('supplierWarehouse', '西瓜', [
        { name: '克', fee: 1 },
        { name: '包', fee: 1000, isSupplier: true }
      ], 'supplierCategoryId')
    ];
  }

  private buildStore(store: StoreDef): BaseTest[] {
    const key = store.key;
    const supplierIdVar = `${key}SupplierId`;
    const categoryIdVar = `${key}CategoryId`;
    return [
      new AddWarehouse({
        name: STORE_NAME,
        type: 'store',
        variableType: key
      }).setRemark(`创建${store.title}，仓库名=${STORE_NAME}`),
      new ChangeToWarehouse(key, `切换到${store.title}`),
      new Action({
        name: `${store.title}新增分类`,
        url: '/app/category/addCategory',
        param: {
          name: '水果',
          warehouseGroupId: `\${${key}.warehouseGroupId}`
        }
      }, {
        buildVariable(result) {
          return { [categoryIdVar]: result.result.categoryId };
        }
      }),
      new Action({
        name: `${store.title}新增供应商`,
        url: '/app/supplier/addsupplier',
        method: 'POST',
        param: {
          name: SUPPLIER_NAME,
          warehouseGroupId: `\${${key}.warehouseGroupId}`,
          type: 'supplier'
        }
      }, {
        buildVariable(result) {
          return { [supplierIdVar]: result.result.supplierId };
        }
      }),
      this.saveMaterial(key, '香蕉', [
        { name: store.bananaUnit, fee: 1, isSupplier: true }
      ], categoryIdVar, supplierIdVar, 10),
      this.saveMaterial(key, '苹果', [
        { name: '袋', fee: 1, isSupplier: true },
        { name: '斤', fee: 10 }
      ], categoryIdVar, supplierIdVar, 2),
      this.saveMaterial(key, '西瓜', [
        { name: '克', fee: 1 },
        { name: '包', fee: 1000, isSupplier: true }
      ], categoryIdVar, supplierIdVar, 3),
      this.saveMaterial(key, '葡萄', [
        { name: store.grapeUnit, fee: 1, isSupplier: true }
      ], categoryIdVar, supplierIdVar, 1),
      new Action({
        name: `${store.title}读取物料`,
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: `\${${key}.warehouseId}`,
          warehouseGroupId: `\${${key}.warehouseGroupId}`
        }
      }, {
        buildVariable(result) {
          return {
            [`${key}Materials`]: ArrayUtil.toMapByKey(result.result.content ?? [], 'name')
          };
        }
      }),
      new CreateStoreNote(store),
      new Action({
        name: `${store.title}发送订单`,
        url: '/app/note/sendNote',
        method: 'POST',
        param: {
          noteIds: `\${${key}NoteIds}`,
          status: 'normal',
          warehouseId: `\${${key}.warehouseId}`,
          warehouseGroupId: `\${${key}.warehouseGroupId}`
        }
      })
    ];
  }

  private buildLink(store: StoreDef): BaseTest[] {
    const key = store.key;
    const warehouseType = key as IOpt['warehouseType'];
    return [
      new SaveShareData({
        data: {
          noteId: `\${${key}NoteId}`
        }
      }).setRemark(`${store.title}保存分享`),
      new Action({
        url: '/share/shareNote',
        name: `${store.title}查询分享单`,
        param: {
          shareDataNo: '${shareDataNo}',
          usersId: '${usersId}',
          warehouseGroupId: `\${${key}.warehouseGroupId}`
        }
      }),
      new ChangeToWarehouse('supplierWarehouse', '切换到供应商仓接单'),
      new Action({
        url: '/app/note/linkNote',
        name: `${store.title}供应商接单`,
        method: 'POST',
        param: {
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}',
          _shareDataNo: '${shareDataNo}'
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),
      new ChangeToWarehouse(key, `切回${store.title}`),
      new QueryAction({
        name: `${store.title}记下链接单`,
        url: '/app/note/listNote',
        query: {
          noteId: `\${${key}NoteId}`
        }
      }, {
        warehouseType,
        buildVariable(result) {
          const row = (result.result.content ?? [])[0];
          CheckUtil.expectEqual(row?.linkNoteId != null && row.linkNoteId !== 0, true, `${store.title}缺少 linkNoteId`);
          CheckUtil.expectEqual(
            String(row.title),
            String(row.noteId),
            `${store.title}主单title应等于订单号，title=${row.title} noteId=${row.noteId}`
          );
          return {
            [`${key}LinkNoteId`]: row.linkNoteId
          };
        }
      }),
      new ChangeToWarehouse('supplierWarehouse', `切换到供应商仓检查${store.title}订单号`),
      new QueryAction({
        name: `${store.title}检查链接单订单号`,
        url: '/app/note/listNote',
        query: {
          noteId: `\${${key}LinkNoteId}`
        }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          const row = (result.result.content ?? [])[0];
          CheckUtil.expectEqual(row != null, true, `${store.title}未找到链接单`);
          CheckUtil.expectEqual(
            String(row?.title),
            String(row?.linkNoteId),
            `${store.title}链接单title应等于主单订单号，title=${row?.title} 主单订单号=${row?.linkNoteId}`
          );
          return {};
        }
      }),
      new ChangeToWarehouse(key, `切回${store.title}`)
    ];
  }

  private buildVerify(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new ChangeToWarehouse('supplierWarehouse', '切换到供应商仓校验'),
      new QueryAction({
        name: '校验供应商物料',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        query: {
          warehouseId: '${supplierWarehouse.warehouseId}',
          pageSize: 100
        }
      }, {
        warehouseType: 'supplierWarehouse',
        check(result) {
          const names = (result.result.content ?? []).map((row: any) => row.name);
          CheckUtil.expectEqual(hasName(names, '苹果'), true, `苹果应按斤匹配，实际=${JSON.stringify(names)}`);
          CheckUtil.expectEqual(hasName(names, '西瓜'), true, `西瓜应匹配，实际=${JSON.stringify(names)}`);
          CheckUtil.expectEqual(hasName(names, '香蕉'), true, '供应商原香蕉应保留');
          CheckUtil.expectEqual(hasName(names, `香蕉(${STORE_NAME})_1`), true, '门店A香蕉瓶应对不上，新建 香蕉(测试门店)_1');
          CheckUtil.expectEqual(hasName(names, `香蕉(${STORE_NAME})_2`), true, '门店B香蕉箱应对不上，新建 香蕉(测试门店)_2');
          CheckUtil.expectEqual(hasName(names, `香蕉(${STORE_NAME})_3`), true, '门店C香蕉袋应对不上，新建 香蕉(测试门店)_3');
          CheckUtil.expectEqual(hasName(names, '葡萄'), true, '葡萄应在供应商新建');
          CheckUtil.expectEqual(
            names.filter((name: string) => name === '葡萄' || name.startsWith('葡萄(')).length,
            1,
            `葡萄应按公制重量匹配，不应再建 葡萄(测试门店)_n，实际=${JSON.stringify(names)}`
          );
          CheckUtil.expectEqual(
            names.some((name: string) => name.startsWith('苹果(')),
            false,
            `苹果不应新建后缀物料，实际=${JSON.stringify(names)}`
          );
          CheckUtil.expectEqual(
            names.some((name: string) => name.startsWith('西瓜(')),
            false,
            `西瓜不应新建后缀物料，实际=${JSON.stringify(names)}`
          );
        }
      }),
      new QueryAction({
        name: '校验供应商门店列表',
        url: '/app/supplier/listsupplier',
        query: {
          pageSize: 100
        }
      }, {
        warehouseType: 'supplierWarehouse',
        check(result) {
          const content = result.result.content ?? [];
          const stores = content.filter((row: any) => row.type === 'store');
          const names = stores.map((row: any) => row.name);
          CheckUtil.expectEqual(hasName(names, STORE_NAME), true, `第一家门店应直接用门店名，实际=${JSON.stringify(names)}`);
          const idNameB = `${STORE_NAME}(${variable.storeB?.warehouseId})`;
          const idNameC = `${STORE_NAME}(${variable.storeC?.warehouseId})`;
          CheckUtil.expectEqual(hasName(names, idNameB), true, `门店B应命名为 ${idNameB}，实际=${JSON.stringify(names)}`);
          CheckUtil.expectEqual(hasName(names, idNameC), true, `门店C应命名为 ${idNameC}，实际=${JSON.stringify(names)}`);
          CheckUtil.expectEqual(stores.length, 3, `供应商门店列表应为3条，实际=${stores.length}`);
        }
      }),
      new QueryAction({
        name: '校验供应商订单',
        url: '/app/note/listNote',
        query: {
          pageSize: 100
        }
      }, {
        warehouseType: 'supplierWarehouse',
        check(result) {
          const content = (result.result.content ?? []).filter((row: any) => row.isDel !== 1);
          CheckUtil.expectEqual(content.length, 3, `供应商应有3张链接单，实际=${content.length}`);
          for (const row of content) {
            CheckUtil.expectEqual(row.materialCnt, 4, `链接单物料数应为4，noteId=${row.noteId} materialCnt=${row.materialCnt}`);
          }
        }
      })
    ];
  }

  private buildSupplierOut(): BaseTest[] {
    const actions: BaseTest[] = [
      new ChangeToWarehouse('supplierWarehouse', '切换到供应商仓出库')
    ];
    for (const store of STORES) {
      actions.push(
        new QueryAction({
          name: `${store.title}加载供应商明细供发货`,
          url: '/app/noteItem/listNoteItem',
          query: {
            noteId: `\${${store.key}LinkNoteId}`
          }
        }, {
          warehouseType: 'supplierWarehouse',
          buildVariable(result) {
            return {
              [`${store.key}SupplierNoteItems`]: result.result.content ?? []
            };
          }
        })
      );
    }
    actions.push(new Action({
      name: '供应商发货前盘点',
      remark: `昨天盘点：订货数量再多 ${INIT_EXTRA}。盘点在当天 23:59，必须早于发货`,
      url: '/app/inventory/setInventoryByArray',
      method: 'POST',
      param: {
        warehouseId: '${supplierWarehouse.warehouseId}',
        warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
      }
    }, {
      warehouseType: 'supplierWarehouse',
      parseHttpParam(param, variable) {
        const built = buildSupplierInit(variable);
        variable.supplierInitStock = built.initStock;
        return {
          warehouseId: param.warehouseId,
          warehouseGroupId: param.warehouseGroupId,
          bussinessDate: inventoryDay(),
          array: built.array
        };
      }
    }));
    // 门店A/C：物料途径 processNote；门店B：批量途径 batchProcessNote
    for (const store of STORES) {
      if (store.key === 'storeB') {
        actions.push(...this.buildSupplierOutByBatch(store));
      } else {
        actions.push(...this.buildSupplierOutByItem(store));
      }
      actions.push(this.buildCheckSupplierOp(store));
      actions.push(this.buildCheckSupplierNoteTime(store));
    }
    return actions;
  }

  /** 物料途径：processNote 拣货/发货/出库 */
  private buildSupplierOutByItem(store: StoreDef): BaseTest[] {
    return [
      new ProcessNote({
        action: 'pick',
        noteId: `\${${store.key}LinkNoteId}`,
        noteItems: `\${${store.key}SupplierNoteItems}`
      }, {
        warehouseType: 'supplierWarehouse'
      }).setRemark(`${store.title}物料途径拣货`),
      new ProcessNote({
        action: 'send',
        noteId: `\${${store.key}LinkNoteId}`,
        noteItems: `\${${store.key}SupplierNoteItems}`,
        buildItem(item) {
          item.sendCnt = item.cnt;
          return item;
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }).setRemark(`${store.title}物料途径发货`),
      new QueryAction({
        name: `${store.title}加载供应商明细供出库`,
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: `\${${store.key}LinkNoteId}`
        }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          return {
            [`${store.key}SupplierNoteItems`]: result.result.content ?? []
          };
        }
      }),
      new ProcessNote({
        action: 'outstock',
        noteId: `\${${store.key}LinkNoteId}`,
        noteItems: `\${${store.key}SupplierNoteItems}`,
        buildItem(item) {
          item.outstockCnt = item.sendCnt ?? item.cnt;
          return item;
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }).setRemark(`${store.title}物料途径出库`)
    ];
  }

  /** 批量途径：batchProcessNote 拣货/发货/出库 */
  private buildSupplierOutByBatch(store: StoreDef): BaseTest[] {
    const actions: BaseTest[] = [];
    for (const action of ['pick', 'send', 'outstock'] as const) {
      actions.push(new Action({
        name: `${store.title}批量${action}`,
        remark: `${store.title}批量途径 ${action}`,
        url: '/app/note/batchProcessNote',
        method: 'POST',
        param: {
          action,
          noteIds: [],
          type: 'send',
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
        }
      }, {
        warehouseType: 'supplierWarehouse',
        parseHttpParam(param, variable) {
          param.noteIds = [variable[`${store.key}LinkNoteId`]];
          return param;
        }
      }));
    }
    // 发货后重载明细，供后续库存校验读 sendCnt
    actions.push(new QueryAction({
      name: `${store.title}批量后重载明细`,
      url: '/app/noteItem/listNoteItem',
      query: {
        noteId: `\${${store.key}LinkNoteId}`
      }
    }, {
      warehouseType: 'supplierWarehouse',
      buildVariable(result) {
        return {
          [`${store.key}SupplierNoteItems`]: result.result.content ?? []
        };
      }
    }));
    return actions;
  }

  /** 校验拣货/发货/出库的操作人与时间已写入 */
  private buildCheckSupplierOp(store: StoreDef): BaseTest {
    const variable = this.getVariable();
    return new QueryAction({
      name: `${store.title}校验拣货发货出库操作人时间`,
      url: '/app/noteItem/listNoteItem',
      query: {
        noteId: `\${${store.key}LinkNoteId}`
      }
    }, {
      warehouseType: 'supplierWarehouse',
      check(result) {
        const array = result.result.content ?? [];
        CheckUtil.expectEqual(array.length > 0, true, `${store.title}出库后应有明细`);
        const usersId = Number(variable.usersId);
        for (const row of array) {
          CheckUtil.expectEqual(
            Number(row.pickUser),
            usersId,
            `${store.title}${row.noteItemId} pickUser 应为当前用户${usersId}，实际=${row.pickUser}`
          );
          CheckUtil.expectEqual(
            row.pickTime != null && row.pickTime !== '',
            true,
            `${store.title}${row.noteItemId} pickTime 不应为空`
          );
          CheckUtil.expectEqual(
            Number(row.sendUser),
            usersId,
            `${store.title}${row.noteItemId} sendUser 应为当前用户${usersId}，实际=${row.sendUser}`
          );
          CheckUtil.expectEqual(
            row.sendTime != null && row.sendTime !== '',
            true,
            `${store.title}${row.noteItemId} sendTime 不应为空`
          );
          CheckUtil.expectEqual(
            Number(row.outstockUser),
            usersId,
            `${store.title}${row.noteItemId} outstockUser 应为当前用户${usersId}，实际=${row.outstockUser}`
          );
          CheckUtil.expectEqual(
            row.outStockTime != null && row.outStockTime !== '',
            true,
            `${store.title}${row.noteItemId} outStockTime 不应为空`
          );
        }
      }
    }).setRemark(`${store.title}校验拣货/发货/出库操作人与时间`);
  }

  /** 校验订单上的接单/拣货/发货/出库时间 */
  private buildCheckSupplierNoteTime(store: StoreDef): BaseTest {
    return new QueryAction({
      name: `${store.title}校验订单操作时间`,
      url: '/app/note/listNote',
      query: {
        noteId: `\${${store.key}LinkNoteId}`
      }
    }, {
      warehouseType: 'supplierWarehouse',
      check(result) {
        const row = (result.result.content ?? [])[0];
        CheckUtil.expectEqual(row != null, true, `${store.title}应能查到供应商订单`);
        for (const col of ['acceptTime', 'pickTime', 'sendTime', 'outstockTime']) {
          CheckUtil.expectEqual(
            row?.[col] != null && row[col] !== '',
            true,
            `${store.title}订单 ${col} 不应为空，实际=${row?.[col]}`
          );
        }
        CheckUtil.expectEqual(
          row?.statementTime == null || row.statementTime === '',
          true,
          `${store.title}订单 statementTime 应为空，实际=${row?.statementTime}`
        );
      }
    }).setRemark(`${store.title}订单 accept/pick/send/outstock 时间已写入`);
  }

  /**
   * 三家门店都发货后，按发货明细的 materialId 核对库存。
   * material 表没有 warehouseId，这里不查物料表。
   */
  private buildCheckSupplierStock(): BaseTest {
    const variable = this.getVariable();
    return new Action({
      name: '校验供应商发货扣库存',
      remark: '库存 = 盘点初始值 - 发货数量，并有 type=send 的负流水',
      url: '/free/query',
      param: {
        array: [
          {
            table: 'stock',
            query: {
              warehouseId: '${supplierWarehouse.warehouseId}',
              warehouseGroupId: '${supplierWarehouse.warehouseGroupId}',
              isDel: 0
            }
          },
          {
            table: 'stockRecord',
            query: {
              warehouseId: '${supplierWarehouse.warehouseId}',
              warehouseGroupId: '${supplierWarehouse.warehouseGroupId}',
              isDel: 0,
              type: 'send'
            }
          }
        ]
      }
    }, {
      check(result) {
        const data = result.result ?? {};
        const stocks: any[] = data.stock ?? [];
        const records: any[] = data.stockRecord ?? [];
        const sendItems = ['storeA', 'storeB', 'storeC'].flatMap(
          key => variable[`${key}SupplierNoteItems`] ?? []
        );
        const groups = new Map<string, any[]>();
        for (const item of sendItems) {
          const id = String(item.materialId);
          const list = groups.get(id) ?? [];
          list.push(item);
          groups.set(id, list);
        }
        CheckUtil.expectEqual(groups.size > 0, true, '供应商发货明细为空');
        for (const [materialId, items] of groups) {
          const name = items[0].name ?? materialId;
          const sent = sumStocks(items.map(row => readStock(row.sendCnt, row.buyUnitFee)));
          const init = variable.supplierInitStock?.[materialId];
          CheckUtil.expectEqual(init != null, true, `${name}缺少盘点初始库存`);
          const expectStock = minusStock(
            { cnt: Number(init.cnt), buyUnitFee: Number(init.buyUnitFee) },
            sent
          );
          const stock = stocks.find(row => String(row.materialId) === materialId);
          CheckUtil.expectEqual(stock != null, true, `${name}发货后应有库存行`);
          CheckUtil.expectEqual(
            StockUtil.isEq(
              { cnt: Number(stock.cnt), buyUnitFee: Number(stock.buyUnitFee) },
              expectStock
            ),
            true,
            `${name}库存应为盘点初始值减去发货数量，期望=${JSON.stringify(expectStock)} 实际cnt=${stock.cnt} buyUnitFee=${stock.buyUnitFee}`
          );
          const recs = records.filter(row => String(row.materialId) === materialId);
          CheckUtil.expectEqual(recs.length > 0, true, `${name}应写入 type=send 的 stock_record`);
          for (const rec of recs) {
            const change = rec.cntOfChange != null ? Number(rec.cntOfChange) : Number(rec.cnt);
            CheckUtil.expectEqual(change < 0, true, `${name}发货流水数量应为负，实际=${change}`);
          }
        }
        const sentIds = new Set(groups.keys());
        for (const stock of stocks) {
          CheckUtil.expectEqual(
            sentIds.has(String(stock.materialId)),
            true,
            `未发货物料不应产生库存 materialId=${stock.materialId}`
          );
        }
      }
    });
  }

  private buildCheckLinkInstock(store: StoreDef): BaseTest[] {
    const key = store.key;
    const warehouseType = key as IOpt['warehouseType'];
    const variable = this.getVariable();
    const expectPurchase = store.items;
    return [
      new QueryAction({
        name: `${store.title}出库后查供应商明细`,
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: `\${${key}LinkNoteId}`
        }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          return {
            [`${key}SupplierNoteItems`]: result.result.content ?? []
          };
        }
      }),
      new ChangeToWarehouse(key, `切换到${store.title}看对方出库`),
      new QueryAction({
        name: `${store.title}校验 linkInstockCnt`,
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: `\${${key}NoteId}`
        }
      }, {
        warehouseType,
        check(result) {
          const storeItems = result.result.content ?? [];
          const supplierItems = variable[`${key}SupplierNoteItems`] ?? [];
          CheckUtil.expectEqual(storeItems.length, 4, `${store.title}明细应为4条`);
          for (const expect of expectPurchase) {
            const storeRow = storeItems.find((row: any) => row.name === expect.name);
            CheckUtil.expectEqual(storeRow != null, true, `${store.title}缺少${expect.name}`);
            CheckUtil.expectEqual(
              StockUtil.isEq(
                { cnt: storeRow.purcharse?.cnt, buyUnitFee: storeRow.purcharse?.buyUnitFee },
                { cnt: expect.cnt, buyUnitFee: storeRow.purcharse?.buyUnitFee }
              ),
              true,
              `${store.title}${expect.name}本行采购量不应被供应商出库改写，实际=${JSON.stringify(storeRow.purcharse)}`
            );
            CheckUtil.expectEqual(
              StockUtil.isEqPrice(
                { price: storeRow.supplierMaterial.price, buyUnitFee: storeRow.supplierMaterial.buyUnitFee },
                { price: expect.price, buyUnitFee: storeRow.supplierMaterial.buyUnitFee }
              ),
              true,
              `${store.title}${expect.name}单价应为${expect.price}，实际=${JSON.stringify(storeRow.supplierMaterial)}`
            );
          }
          for (const storeRow of storeItems) {
            const supplierRow = supplierItems.find(
              (row: any) => String(row.noteItemId) === String(storeRow.linkNoteItemId)
            );
            CheckUtil.expectEqual(supplierRow != null, true, `${store.title}未找到供应商明细${storeRow.name}`);
            CheckUtil.expectEqual(supplierRow.outstock != null, true, `${store.title}${storeRow.name}供应商缺少outstock`);
            CheckUtil.expectEqual(storeRow.linkOutstockCnt != null, true, `${store.title}${storeRow.name}缺少linkOutstockCnt`);
            const materialLink = {
              unitFee: supplierRow.linkUnitFee,
              linkUnitFee: storeRow.linkUnitFee
            };
            const expectedCnt = MaterialLinkUtil.parseCnt(materialLink, supplierRow.outstock.cnt);
            CheckUtil.expectEqual(expectedCnt !== 0, true, `${store.title}${storeRow.name}供应商出库数量不应为0`);
            CheckUtil.expectEqual(
              StockUtil.isEq(
                { cnt: expectedCnt, buyUnitFee: storeRow.linkOutstockCnt.buyUnitFee },
                storeRow.linkOutstockCnt
              ),
              true,
              `${store.title}${storeRow.name} linkOutstockCnt 应从供应商出库组装，期望cnt=${expectedCnt} 实际=${JSON.stringify(storeRow.linkOutstockCnt)}`
            );
          }
        }
      }),
      new CheckArray([{
        table: 'noteItem',
        query: {
          noteId: `\${${key}NoteId}`,
          warehouseId: `\${${key}.warehouseId}`,
          warehouseGroupId: `\${${key}.warehouseGroupId}`,
          isDel: 0
        },
        notWarehouseGroupId: true,
        check(array) {
          CheckUtil.expectEqual(array.length, 4, `${store.title} note_item 应为4条`);
          for (const row of array) {
            CheckUtil.expectEqual(
              StockUtil.isEq(
                { cnt: row.instockCnt ?? 0, buyUnitFee: row.buyUnitFee },
                { cnt: 0, buyUnitFee: row.buyUnitFee }
              ),
              true,
              `${store.title}本行 instockCnt 不应被供应商出库改写，实际=${row.instockCnt}`
            );
          }
        }
      }])
    ];
  }

  private buildRenameStores(): BaseTest[] {
    const actions: BaseTest[] = [];
    for (const store of STORES) {
      const key = store.key;
      const warehouseType = key as IOpt['warehouseType'];
      actions.push(
        new ChangeToWarehouse(key, `切换到${store.title}改名`),
        new Action({
          name: `将测试门店改为${store.title}`,
          url: '/app/warehouse/updateWarehouse',
          method: 'POST',
          param: {
            warehouseId: `\${${key}.warehouseId}`,
            warehouseGroupId: `\${${key}.warehouseGroupId}`,
            name: store.title
          }
        }, {
          warehouseType
        }),
        new CheckArray([{
          table: 'warehouse',
          query: {
            warehouseId: `\${${key}.warehouseId}`,
            warehouseGroupId: `\${${key}.warehouseGroupId}`
          },
          notWarehouseGroupId: true,
          check(array) {
            CheckUtil.expectEqual(array.length, 1, `${store.title}仓库应存在`);
            CheckUtil.expectEqual(array[0].name, store.title, `${key} 名称应为 ${store.title}，实际=${array[0]?.name}`);
          }
        }])
      );
    }
    return actions;
  }

  private saveMaterial(
    warehouseKey: string,
    name: string,
    buyUnit: any[],
    categoryIdVar: string,
    supplierIdVar?: string,
    price?: number
  ): BaseTest {
    const suppliers = supplierIdVar ? [{
      isDef: true,
      supplierId: `\${${supplierIdVar}}`,
      price: price ?? 10
    }] : [];
    return new Action({
      name: `${warehouseKey}增加商品：${name}`,
      url: '/app/material/SaveMaterial',
      method: 'POST',
      param: {
        name,
        remark: '',
        img: [],
        buyUnit,
        suppliers,
        warehouseId: `\${${warehouseKey}.warehouseId}`,
        warehouseGroupId: `\${${warehouseKey}.warehouseGroupId}`,
        category: { categoryId: `\${${categoryIdVar}}` }
      }
    });
  }
}

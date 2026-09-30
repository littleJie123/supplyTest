import { ArrayUtil, BaseTest, CheckUtil, HttpAction, MultiSheetDownloadAction, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import Action from "../../action/Action";
import QueryAction from "../../action/QueryAction";
import SaveShareData from "../../action/shareData/SaveShareData";
import NoteItemUtil from "../../util/NoteItemUtil";
import StockUtil from "../../util/StockUtil";
import IOpt from "../../inf/IOpt";
import { AddWarehouseUsers } from "../user/AddWarehouseUsers";

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
  lycheeUnit?: string;
  items0801: OrderItemDef[];
  items0815?: OrderItemDef[];
  items0820?: OrderItemDef[];
}

const STORES: StoreDef[] = [
  {
    key: 'storeA',
    title: '门店A',
    bananaUnit: '瓶',
    grapeUnit: '斤',
    items0801: [
      { name: '香蕉', cnt: 5, unit: '瓶', price: 10 },
      { name: '苹果', cnt: 10, unit: '袋', price: 2 },
      { name: '西瓜', cnt: 15, unit: '包', price: 3 },
      { name: '葡萄', cnt: 20, unit: '斤', price: 1 }
    ],
    items0815: [
      { name: '西瓜', cnt: 500, unit: '克', price: 0.3 },
      { name: '葡萄', cnt: 20, unit: '斤', price: 1 }
    ]
  },
  {
    key: 'storeB',
    title: '门店B',
    bananaUnit: '箱',
    grapeUnit: '公斤',
    items0801: [
      { name: '香蕉', cnt: 5, unit: '箱', price: 10 },
      { name: '苹果', cnt: 10, unit: '袋', price: 2 },
      { name: '西瓜', cnt: 15, unit: '包', price: 3 },
      { name: '葡萄', cnt: 20, unit: '公斤', price: 1 }
    ],
    items0815: [
      { name: '香蕉', cnt: 1, unit: '箱', price: 10 },
      { name: '苹果', cnt: 2, unit: '袋', price: 2 }
    ]
  },
  {
    key: 'storeC',
    title: '门店C',
    bananaUnit: '袋',
    grapeUnit: '千克',
    lycheeUnit: '公斤',
    items0801: [
      { name: '香蕉', cnt: 5, unit: '袋', price: 10 },
      { name: '苹果', cnt: 10, unit: '袋', price: 2 },
      { name: '西瓜', cnt: 15, unit: '包', price: 3 },
      { name: '葡萄', cnt: 15, unit: '千克', price: 1 },
      { name: '荔枝', cnt: 2, unit: '公斤', price: 10 }
    ],
    items0820: [
      { name: '荔枝', cnt: 1, unit: '公斤', price: 10 }
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

function isEmptyCell(val: any): boolean {
  return val == null || val === '' || Number(val) === 0;
}

function checkCnt(actual: any, expected: number, tag: string) {
  CheckUtil.expectEqual(
    StockUtil.isEq(
      { cnt: Number(actual), buyUnitFee: 1 },
      { cnt: expected, buyUnitFee: 1 }
    ),
    true,
    `${tag} 期望${expected}，实际${actual}`
  );
}

function checkPrice(actual: any, expected: number, tag: string) {
  CheckUtil.expectEqual(
    StockUtil.isEqPrice(
      { price: Number(actual), buyUnitFee: 1 },
      { price: expected, buyUnitFee: 1 }
    ),
    true,
    `${tag} 期望${expected}，实际${actual}`
  );
}

function checkMoney(actual: any, expected: number, tag: string) {
  CheckUtil.expectEqual(
    StockUtil.isNumEq(Number(actual), expected),
    true,
    `${tag} 期望${expected}，实际${actual}`
  );
}

interface MaterialExpect {
  name: string;
  unit: string;
  total: number;
  stores: { [storeName: string]: number | '' };
}

class ChangeToWarehouse extends Action {
  constructor(targetKey: string, title?: string) {
    super({
      name: title ?? `切换仓库:${targetKey}`,
      remark: `切换到${targetKey}`,
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
  private idKey: string;

  constructor(store: StoreDef, items: OrderItemDef[], idKey: string, title: string) {
    super({
      name: title,
      remark: title,
      url: '/app/note/createNote',
      method: 'POST',
      param: {}
    });
    this.storeKey = store.key;
    this.orderItems = items;
    this.idKey = idKey;
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
      [this.idKey]: notes[0]?.noteId,
      [`${this.idKey}s`]: ArrayUtil.toArray(notes, 'noteId')
    };
  }

  protected async checkResult(result: any): Promise<void> {
    const notes = Array.isArray(result.result) ? result.result : [];
    if (notes[0]?.noteId == null) {
      throw new Error(`${this.storeKey} createNote 未返回 noteId: ${JSON.stringify(result.result)}`);
    }
  }
}

class CheckStateNote4SupplierExcel extends MultiSheetDownloadAction {
  private storeNames: string[];
  private expects: MaterialExpect[];
  private sendExpects: MaterialExpect[];

  constructor(opt: {
    name: string;
    remark: string;
    begin: string;
    end?: string;
    storeNames: string[];
    expects: MaterialExpect[];
    sendExpects: MaterialExpect[];
  }) {
    super({
      name: opt.name,
      remark: opt.remark,
      url: '/app/state/stateNote4Supplier',
      highlight: true,
      param: {
        begin: opt.begin,
        end: opt.end,
        warehouseId: '${supplierWarehouse.warehouseId}',
        warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
      }
    });
    this.storeNames = opt.storeNames;
    this.expects = opt.expects;
    this.sendExpects = opt.sendExpects;
  }

  protected async checkResult(sheets: any): Promise<void> {
    await super.checkResult(sheets);
    this.checkQtySheet(sheets, '订货数量合计', '订货数量合计', this.expects);
    this.checkQtySheet(sheets, '发货数量合计', '发货数量合计', this.sendExpects);
  }

  private checkQtySheet(
    sheets: any,
    sheetName: string,
    totalCol: string,
    expects: MaterialExpect[]
  ) {
    let rows = sheets[sheetName];
    CheckUtil.expectEqual(rows != null, true,
      `缺少sheet「${sheetName}」，实际=${JSON.stringify(Object.keys(sheets ?? {}))}`);
    CheckUtil.expectEqual(rows.length, expects.length,
      `${sheetName}物料行数期望${expects.length}，实际${rows.length}，${JSON.stringify(rows)}`);
    if (expects.length === 0) {
      return;
    }
    let sample = rows[0] ?? {};
    for (let storeName of this.storeNames) {
      CheckUtil.expectEqual(storeName in sample, true,
        `${sheetName}应有门店列「${storeName}」，实际列=${JSON.stringify(Object.keys(sample))}`);
    }
    let extraStores = ['门店A', '门店B', '门店C'].filter(name =>
      this.storeNames.indexOf(name) < 0 && name in sample
    );
    CheckUtil.expectEqual(extraStores.length, 0,
      `${sheetName}不应出现门店列${JSON.stringify(extraStores)}，实际列=${JSON.stringify(Object.keys(sample))}`);
    for (let expect of expects) {
      let row = rows.find((r: any) => r['物料名'] == expect.name);
      CheckUtil.expectEqual(row != null, true,
        `${sheetName}缺少物料「${expect.name}」，实际=${JSON.stringify(rows)}`);
      CheckUtil.expectEqual(row['单位'], expect.unit,
        `${sheetName} ${expect.name}.单位期望${expect.unit}，实际${row['单位']}`);
      checkCnt(row[totalCol], expect.total, `${sheetName} ${expect.name}.${totalCol}`);
      for (let storeName of this.storeNames) {
        let actual = row[storeName];
        let storeExpect = expect.stores[storeName];
        if (storeExpect === '' || storeExpect == null) {
          CheckUtil.expectEqual(isEmptyCell(actual), true,
            `${sheetName} ${expect.name}.${storeName}应为空，实际=${actual}`);
        } else {
          checkCnt(actual, storeExpect as number, `${sheetName} ${expect.name}.${storeName}`);
        }
      }
    }
  }
}

interface SalesStatusCnt {
  待接单: number;
  待拣货: number;
  待发货: number;
  待出库: number;
  未对账: number;
  已对账: number;
}

interface SalesStoreExpect {
  name: string;
  orderCnt: number;
  status: SalesStatusCnt;
  orderMoney: number;
  sendMoney?: number;
  outstockMoney?: number;
  statementMoney?: number;
}

interface SalesOrderExpect {
  noteKey: string;
  day: string;
  status: string;
  materialCnt: number;
  orderMoney: number;
  typeName?: string;
  /** 退货单已出库时，出库金额为负数，发货金额为 0。正常出库单发货金额与订货相同 */
  outstockMoney?: number;
  sendMoney?: number;
  /** 已对账时，发货、出库、对账金额都填这个值 */
  statementMoney?: number;
}

interface SalesMaterialExpect {
  noteKey: string;
  name: string;
  unit: string;
  orderCnt: number;
  price: number;
  orderMoney: number;
  outstockCnt?: number;
  outstockMoney?: number;
  sendCnt?: number;
  sendMoney?: number;
  /** 已对账时，发货、出库、对账数量和金额与订货一致 */
  statementCnt?: number;
  statementMoney?: number;
}

const SALES_STATUS_KEYS = ['待接单', '待拣货', '待发货', '待出库', '未对账', '已对账'];

class CheckStateSales4SupplierExcel extends MultiSheetDownloadAction {
  private stores: SalesStoreExpect[];
  private orders: { [storeName: string]: SalesOrderExpect[] };
  private materials: { [storeName: string]: SalesMaterialExpect[] };
  private absentStores: string[];

  constructor(opt: {
    name: string;
    remark: string;
    begin: string;
    end?: string;
    stores: SalesStoreExpect[];
    orders: { [storeName: string]: SalesOrderExpect[] };
    materials: { [storeName: string]: SalesMaterialExpect[] };
    absentStores?: string[];
  }) {
    super({
      name: opt.name,
      remark: opt.remark,
      url: '/app/state/stateSales4Supplier',
      highlight: true,
      param: {
        begin: opt.begin,
        end: opt.end,
        warehouseId: '${supplierWarehouse.warehouseId}',
        warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
      }
    });
    this.stores = opt.stores;
    this.orders = opt.orders;
    this.materials = opt.materials;
    this.absentStores = opt.absentStores ?? [];
  }

  protected async checkResult(sheets: any): Promise<void> {
    await super.checkResult(sheets);
    this.checkStoreSheet(sheets['餐厅列表']);
    for (let store of this.stores) {
      this.checkOrderSheet(sheets[`${store.name}的订单`], store.name);
      this.checkMaterialSheet(sheets[`${store.name}的物料`], store.name);
    }
    for (let name of this.absentStores) {
      CheckUtil.expectEqual(sheets[`${name}的订单`] == null, true, `${name}不应有订单sheet`);
      CheckUtil.expectEqual(sheets[`${name}的物料`] == null, true, `${name}不应有物料sheet`);
    }
  }

  private checkStoreSheet(rows: any[]) {
    CheckUtil.expectEqual(rows != null, true, '缺少sheet「餐厅列表」');
    CheckUtil.expectEqual(rows.length, this.stores.length + 1,
      `餐厅列表应有${this.stores.length}家餐厅加汇总，实际${rows.length}`);
    for (let expect of this.stores) {
      let row = rows.find((item: any) => item['餐厅名称'] == expect.name);
      CheckUtil.expectEqual(row != null, true, `餐厅列表缺少${expect.name}`);
      CheckUtil.expectEqual(row['订单数量'], expect.orderCnt, `${expect.name}订单数量`);
      for (let key of SALES_STATUS_KEYS) {
        CheckUtil.expectEqual(row[key], expect.status[key], `${expect.name}.${key}`);
      }
      checkMoney(row['订货金额'], expect.orderMoney, `${expect.name}.订货金额`);
      checkMoney(row['发货金额'], expect.sendMoney ?? 0, `${expect.name}.发货金额`);
      checkMoney(row['出库金额'], expect.outstockMoney ?? 0, `${expect.name}.出库金额`);
      checkMoney(row['对账金额'], expect.statementMoney ?? 0, `${expect.name}.对账金额`);
    }
    let total = rows.find((item: any) => item['餐厅名称'] == '汇总');
    CheckUtil.expectEqual(total != null, true, '餐厅列表缺少汇总');
    CheckUtil.expectEqual(total['订单数量'], this.sumStore('orderCnt'), '汇总订单数量');
    for (let key of SALES_STATUS_KEYS) {
      let sum = 0;
      for (let store of this.stores) {
        sum += store.status[key];
      }
      CheckUtil.expectEqual(total[key], sum, `汇总.${key}`);
    }
    checkMoney(total['订货金额'], this.sumStore('orderMoney'), '汇总订货金额');
    checkMoney(total['发货金额'], this.sumStore('sendMoney'), '汇总发货金额');
    checkMoney(total['出库金额'], this.sumStore('outstockMoney'), '汇总出库金额');
    checkMoney(total['对账金额'], this.sumStore('statementMoney'), '汇总对账金额');
  }

  private checkOrderSheet(rows: any[], storeName: string) {
    CheckUtil.expectEqual(rows != null, true, `缺少sheet「${storeName}的订单」`);
    let expects = this.orders[storeName] ?? [];
    let dataRows = (rows ?? []).filter((row: any) => row['接单日期'] != '汇总');
    CheckUtil.expectEqual(dataRows.length, expects.length, `${storeName}订单行数`);
    for (let expect of expects) {
      let noteId = this.noteId(expect.noteKey);
      let row = dataRows.find((item: any) => String(item['订单号']) == noteId);
      CheckUtil.expectEqual(row != null, true, `${storeName}缺少订单${noteId}`);
      CheckUtil.expectEqual(String(row['接单日期']), expect.day, `${storeName} ${noteId}接单日期`);
      CheckUtil.expectEqual(row['订单类型'], expect.typeName ?? '订货单', `${storeName} ${noteId}订单类型`);
      if (expect.status === '') {
        CheckUtil.expectEqual(isEmptyCell(row['订单状态']), true, `${storeName} ${noteId}订单状态应为空`);
      } else {
        CheckUtil.expectEqual(row['订单状态'], expect.status, `${storeName} ${noteId}订单状态`);
      }
      CheckUtil.expectEqual(row['物料数量'], expect.materialCnt, `${storeName} ${noteId}物料数量`);
      checkMoney(row['订货金额'], expect.orderMoney, `${storeName} ${noteId}订货金额`);
      if (expect.statementMoney != null) {
        checkMoney(row['发货金额'], expect.statementMoney, `${storeName} ${noteId}发货金额`);
        checkMoney(row['出库金额'], expect.outstockMoney ?? expect.statementMoney, `${storeName} ${noteId}出库金额`);
        checkMoney(row['对账金额'], expect.statementMoney, `${storeName} ${noteId}对账金额`);
      } else if (expect.outstockMoney == null) {
        CheckUtil.expectEqual(isEmptyCell(row['发货金额']), true, `${storeName} ${noteId}发货金额应为空`);
        CheckUtil.expectEqual(isEmptyCell(row['出库金额']), true, `${storeName} ${noteId}出库金额应为空`);
        CheckUtil.expectEqual(isEmptyCell(row['对账金额']), true, `${storeName} ${noteId}对账金额应为空`);
      } else {
        checkMoney(row['发货金额'], expect.sendMoney ?? 0, `${storeName} ${noteId}发货金额`);
        checkMoney(row['出库金额'], expect.outstockMoney, `${storeName} ${noteId}出库金额`);
        CheckUtil.expectEqual(isEmptyCell(row['对账金额']), true, `${storeName} ${noteId}对账金额应为空`);
      }
    }
    let total = (rows ?? []).find((row: any) => row['接单日期'] == '汇总');
    CheckUtil.expectEqual(total != null, true, `${storeName}订单缺少汇总`);
    let money = 0;
    for (let expect of expects) {
      money += expect.orderMoney;
    }
    checkMoney(total['订货金额'], money, `${storeName}订单汇总订货金额`);
  }

  private checkMaterialSheet(rows: any[], storeName: string) {
    CheckUtil.expectEqual(rows != null, true, `缺少sheet「${storeName}的物料」`);
    let expects = this.materials[storeName] ?? [];
    let dataRows = (rows ?? []).filter((row: any) => row['接单日期'] != '汇总');
    for (let expect of expects) {
      let noteId = this.noteId(expect.noteKey);
      let row = dataRows.find((item: any) =>
        String(item['订单号']) == noteId && item['物料名'] == expect.name
      );
      CheckUtil.expectEqual(row != null, true,
        `${storeName}缺少物料${expect.name}，订单${noteId}，实际=${JSON.stringify(dataRows)}`);
      CheckUtil.expectEqual(row['销售单位'], expect.unit, `${storeName} ${expect.name}销售单位`);
      checkCnt(row['订货数量'], expect.orderCnt, `${storeName} ${expect.name}订货数量`);
      checkPrice(row['销售价格'], expect.price, `${storeName} ${expect.name}销售价格`);
      checkMoney(row['订货金额'], expect.orderMoney, `${storeName} ${expect.name}订货金额`);
      if (expect.statementCnt != null) {
        checkCnt(row['发货数量'], expect.statementCnt, `${storeName} ${expect.name}发货数量`);
        checkCnt(row['出库数量'], expect.outstockCnt ?? expect.statementCnt, `${storeName} ${expect.name}出库数量`);
        checkCnt(row['对账数量'], expect.statementCnt, `${storeName} ${expect.name}对账数量`);
        checkMoney(row['发货金额'], expect.statementMoney, `${storeName} ${expect.name}发货金额`);
        checkMoney(row['出库金额'], expect.outstockMoney ?? expect.statementMoney, `${storeName} ${expect.name}出库金额`);
        checkMoney(row['对账金额'], expect.statementMoney, `${storeName} ${expect.name}对账金额`);
      } else {
        if (expect.sendCnt == null) {
          CheckUtil.expectEqual(isEmptyCell(row['发货数量']), true, `${storeName} ${expect.name}发货数量应为空`);
          CheckUtil.expectEqual(isEmptyCell(row['发货金额']), true, `${storeName} ${expect.name}发货金额应为空`);
        } else {
          checkCnt(row['发货数量'], expect.sendCnt, `${storeName} ${expect.name}发货数量`);
          checkMoney(row['发货金额'], expect.sendMoney, `${storeName} ${expect.name}发货金额`);
        }
        if (expect.outstockCnt == null) {
          CheckUtil.expectEqual(isEmptyCell(row['出库数量']), true, `${storeName} ${expect.name}出库数量应为空`);
          CheckUtil.expectEqual(isEmptyCell(row['出库金额']), true, `${storeName} ${expect.name}出库金额应为空`);
        } else {
          checkCnt(row['出库数量'], expect.outstockCnt, `${storeName} ${expect.name}出库数量`);
          checkMoney(row['出库金额'], expect.outstockMoney, `${storeName} ${expect.name}出库金额`);
        }
        CheckUtil.expectEqual(isEmptyCell(row['对账数量']), true, `${storeName} ${expect.name}对账数量应为空`);
        CheckUtil.expectEqual(isEmptyCell(row['对账金额']), true, `${storeName} ${expect.name}对账金额应为空`);
      }
    }
    let total = (rows ?? []).find((row: any) => row['接单日期'] == '汇总');
    CheckUtil.expectEqual(total != null, true, `${storeName}物料缺少汇总`);
    let money = 0;
    for (let order of this.orders[storeName] ?? []) {
      money += order.orderMoney;
    }
    checkMoney(total['订货金额'], money, `${storeName}物料汇总订货金额`);
  }

  private noteId(noteKey: string): string {
    return String(this.getVariable()[noteKey]);
  }

  private sumStore(key: 'orderCnt' | 'orderMoney' | 'sendMoney' | 'outstockMoney' | 'statementMoney'): number {
    let sum = 0;
    for (let store of this.stores) {
      sum += store[key] ?? 0;
    }
    return sum;
  }
}

function salesStatus(accept: number, picked: number, notStatement: number = 0, statement: number = 0, waitSend: number = 0): SalesStatusCnt {
  return {
    待接单: accept,
    待拣货: picked,
    待发货: waitSend,
    待出库: 0,
    未对账: notStatement,
    已对账: statement
  };
}

class SaveLogin extends BaseTest {
  private tokenKey: string;
  private usersKey: string;

  constructor(tokenKey: string, usersKey: string) {
    super();
    this.tokenKey = tokenKey;
    this.usersKey = usersKey;
    this.remark = '记下当前登录用户';
  }

  getName(): string {
    return '保存当前登录';
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    let variable = this.getVariable();
    return {
      [this.tokenKey]: variable.token,
      [this.usersKey]: variable.usersId
    };
  }
}

class UseLogin extends BaseTest {
  private tokenKey: string;

  constructor(tokenKey: string) {
    super();
    this.tokenKey = tokenKey;
    this.remark = `切换登录 ${tokenKey}`;
  }

  getName(): string {
    return `切换登录${this.tokenKey}`;
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    return {
      token: this.getVariable()[this.tokenKey]
    };
  }
}

interface PickerExpect {
  name?: string;
  nameKey?: string;
  times: number;
  money: number;
}

interface PickerRowExpect {
  store: string;
  noteKey: string;
  material: string;
  unit: string;
  orderCnt: number;
  pickCnt: number;
  pickMoney: number;
  picker?: string;
  pickerKey?: string;
  sendCnt?: number;
}

class CheckStatePickerExcel extends MultiSheetDownloadAction {
  private pickers: PickerExpect[];
  private rows: PickerRowExpect[];
  private absentStores: string[];

  constructor(opt: {
    name: string;
    remark: string;
    begin: string;
    end: string;
    pickers: PickerExpect[];
    rows: PickerRowExpect[];
    absentStores?: string[];
  }) {
    super({
      name: opt.name,
      remark: opt.remark,
      url: '/app/state/statePicker4Supplier',
      highlight: true,
      param: {
        begin: opt.begin,
        end: opt.end,
        warehouseId: '${supplierWarehouse.warehouseId}',
        warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
      }
    });
    this.pickers = opt.pickers;
    this.rows = opt.rows;
    this.absentStores = opt.absentStores ?? [];
  }

  protected async checkResult(sheets: any): Promise<void> {
    await super.checkResult(sheets);
    this.checkPickerSheet(sheets['分拣一览']);
    for (let expect of this.rows) {
      this.checkOrderRow(sheets[`${expect.store}的订单`], expect);
    }
    for (let name of this.absentStores) {
      CheckUtil.expectEqual(sheets[`${name}的订单`] == null, true, `${name}不应有分拣订单sheet`);
    }
  }

  private pickerName(expect: { name?: string; nameKey?: string; picker?: string; pickerKey?: string }): string {
    if (expect.name) {
      return expect.name;
    }
    if (expect.picker) {
      return expect.picker;
    }
    let key = expect.nameKey ?? expect.pickerKey;
    return `工蜂${this.getVariable()[key]}`;
  }

  private checkPickerSheet(rows: any[]) {
    CheckUtil.expectEqual(rows != null, true, '缺少sheet「分拣一览」');
    let dataRows = (rows ?? []).filter((row: any) => row['分拣人'] != '汇总');
    CheckUtil.expectEqual(dataRows.length, this.pickers.length,
      `分拣人数期望${this.pickers.length}，实际${dataRows.length}，${JSON.stringify(dataRows)}`);
    for (let expect of this.pickers) {
      let name = this.pickerName(expect);
      let row = dataRows.find((item: any) => item['分拣人'] == name);
      CheckUtil.expectEqual(row != null, true, `缺少分拣人${name}，实际=${JSON.stringify(dataRows)}`);
      CheckUtil.expectEqual(row['分拣次数'], expect.times, `${name}分拣次数`);
      checkMoney(row['分拣金额'], expect.money, `${name}分拣金额`);
    }
    let total = (rows ?? []).find((row: any) => row['分拣人'] == '汇总');
    CheckUtil.expectEqual(total != null, true, '分拣一览缺少汇总');
    let times = 0;
    let money = 0;
    for (let expect of this.pickers) {
      times += expect.times;
      money += expect.money;
    }
    CheckUtil.expectEqual(total['分拣次数'], times, '汇总分拣次数');
    checkMoney(total['分拣金额'], money, '汇总分拣金额');
  }

  private checkOrderRow(rows: any[], expect: PickerRowExpect) {
    CheckUtil.expectEqual(rows != null, true, `缺少sheet「${expect.store}的订单」`);
    let noteId = String(this.getVariable()[expect.noteKey]);
    let dataRows = (rows ?? []).filter((row: any) => row['订单号'] != '汇总');
    let row = dataRows.find((item: any) =>
      String(item['订单号']) == noteId && item['物料名称'] == expect.material
    );
    CheckUtil.expectEqual(row != null, true,
      `${expect.store}缺少${expect.material}，订单${noteId}，实际=${JSON.stringify(dataRows)}`);
    CheckUtil.expectEqual(row['采购方'], expect.store, `${expect.material}采购方`);
    CheckUtil.expectEqual(row['销售单位'], expect.unit, `${expect.material}销售单位`);
    checkCnt(row['报货数量'], expect.orderCnt, `${expect.material}报货数量`);
    checkCnt(row['拣货数量'], expect.pickCnt, `${expect.material}拣货数量`);
    checkMoney(row['拣货金额'], expect.pickMoney, `${expect.material}拣货金额`);
    CheckUtil.expectEqual(row['分拣人'], this.pickerName(expect), `${expect.material}分拣人`);
    if (expect.sendCnt == null) {
      CheckUtil.expectEqual(isEmptyCell(row['发货数量']), true, `${expect.material}发货数量应为空`);
    } else {
      checkCnt(row['发货数量'], expect.sendCnt, `${expect.material}发货数量`);
    }
  }
}

/**
 * 供应商端门店订货数量汇总 `/app/state/stateNote4Supplier`（见同目录 FlowStateNote4Supplier.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '三门店向供应商发单，按createTime汇总订货数量并下载excel' });
  }

  getName(): string {
    return '报表下载（供应商）';
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId().setRemark('查找最大测试用户id'),
      new GetOpenId().setRemark('注册用户并拿到token'),
      ...this.buildSupplier(),
      new SaveLogin('supplierToken', 'mainUsersId'),
      new AddWarehouseUsers({
        warehouseKey: 'supplierWarehouse',
        remark: '3个分拣人，分拣甲、分拣乙写昵称，分拣丙不写',
        users: [
          { key: 'pickerA', nickName: '分拣甲' },
          { key: 'pickerB', nickName: '分拣乙' },
          { key: 'pickerC' }
        ]
      }),
      ...this.setPickerAdmin(['pickerA', 'pickerB', 'pickerC']),
      new UseLogin('supplierToken'),
      ...this.buildStore(STORES[0]),
      ...this.buildStore(STORES[1]),
      ...this.buildStore(STORES[2]),
      ...this.buildOrder0801(STORES[0]),
      ...this.buildOrder0801(STORES[1]),
      ...this.buildOrder0801(STORES[2]),
      ...this.buildLink(STORES[0], '2026-08-01'),
      ...this.buildLink(STORES[1], '2026-08-01'),
      ...this.buildLink(STORES[2], '2026-08-01'),
      ...this.buildUpdateWatermelon(),
      ...this.buildOrder0815(STORES[0]),
      ...this.buildOrder0815(STORES[1]),
      ...this.buildStoreCStatement(),
      ...this.buildPickOrders(),
      new ChangeToWarehouse('supplierWarehouse', '切换到供应商仓下载报表'),
      this.buildExcelCheck({
        name: '下载08-01至08-15',
        remark: 'begin=2026-08-01 end=2026-08-15，三门店两批订货都计入；仅门店C已发货，荔枝发货为订货一半',
        begin: '2026-08-01',
        end: '2026-08-15',
        storeNames: ['门店A', '门店B', '门店C'],
        expects: [
          { name: '香蕉', unit: '包', total: 16, stores: { '门店A': 5, '门店B': 6, '门店C': 5 } },
          { name: '苹果', unit: '包', total: 0.32, stores: { '门店A': 0.1, '门店B': 0.12, '门店C': 0.1 } },
          { name: '西瓜', unit: '包', total: 45.5, stores: { '门店A': 15.5, '门店B': 15, '门店C': 15 } },
          { name: '葡萄', unit: '斤', total: 110, stores: { '门店A': 40, '门店B': 40, '门店C': 30 } },
          { name: '荔枝', unit: '斤', total: 4, stores: { '门店A': '', '门店B': '', '门店C': 4 } }
        ],
        sendExpects: [
          { name: '香蕉', unit: '包', total: 5, stores: { '门店A': '', '门店B': '', '门店C': 5 } },
          { name: '苹果', unit: '包', total: 0.1, stores: { '门店A': '', '门店B': '', '门店C': 0.1 } },
          { name: '西瓜', unit: '包', total: 15, stores: { '门店A': '', '门店B': '', '门店C': 15 } },
          { name: '葡萄', unit: '斤', total: 30, stores: { '门店A': '', '门店B': '', '门店C': 30 } },
          { name: '荔枝', unit: '斤', total: 2, stores: { '门店A': '', '门店B': '', '门店C': 2 } }
        ]
      }),
      this.buildExcelCheck({
        name: '下载仅08-01',
        remark: '只传begin=2026-08-01，end自动填成同一天；荔枝发货≠订货',
        begin: '2026-08-01',
        storeNames: ['门店A', '门店B', '门店C'],
        expects: [
          { name: '香蕉', unit: '包', total: 15, stores: { '门店A': 5, '门店B': 5, '门店C': 5 } },
          { name: '苹果', unit: '包', total: 0.3, stores: { '门店A': 0.1, '门店B': 0.1, '门店C': 0.1 } },
          { name: '西瓜', unit: '包', total: 45, stores: { '门店A': 15, '门店B': 15, '门店C': 15 } },
          { name: '葡萄', unit: '斤', total: 90, stores: { '门店A': 20, '门店B': 40, '门店C': 30 } },
          { name: '荔枝', unit: '斤', total: 4, stores: { '门店A': '', '门店B': '', '门店C': 4 } }
        ],
        sendExpects: [
          { name: '香蕉', unit: '包', total: 5, stores: { '门店A': '', '门店B': '', '门店C': 5 } },
          { name: '苹果', unit: '包', total: 0.1, stores: { '门店A': '', '门店B': '', '门店C': 0.1 } },
          { name: '西瓜', unit: '包', total: 15, stores: { '门店A': '', '门店B': '', '门店C': 15 } },
          { name: '葡萄', unit: '斤', total: 30, stores: { '门店A': '', '门店B': '', '门店C': 30 } },
          { name: '荔枝', unit: '斤', total: 2, stores: { '门店A': '', '门店B': '', '门店C': 2 } }
        ]
      }),
      this.buildExcelCheck({
        name: '下载仅08-15',
        remark: '只传begin=2026-08-15，门店C未订货不出现；门店A、B未发货，发货sheet无数据',
        begin: '2026-08-15',
        storeNames: ['门店A', '门店B'],
        expects: [
          { name: '香蕉', unit: '包', total: 1, stores: { '门店A': '', '门店B': 1 } },
          { name: '苹果', unit: '包', total: 0.02, stores: { '门店A': '', '门店B': 0.02 } },
          { name: '西瓜', unit: '包', total: 0.5, stores: { '门店A': 0.5, '门店B': '' } },
          { name: '葡萄', unit: '斤', total: 20, stores: { '门店A': 20, '门店B': '' } }
        ],
        sendExpects: []
      }),
      this.buildSalesExcel({
        name: '销售情况08-01至08-15',
        remark: '门店A、B都已拣货为待发货；门店C已结算，荔枝发货为订货一半',
        begin: '2026-08-01',
        end: '2026-08-15',
        stores: [
          { name: '门店A', orderCnt: 2, status: salesStatus(0, 0, 0, 0, 2), orderMoney: 305 },
          { name: '门店B', orderCnt: 2, status: salesStatus(0, 0, 0, 0, 2), orderMoney: 149 },
          { name: '门店C', orderCnt: 1, status: salesStatus(0, 0, 0, 1), orderMoney: 150, sendMoney: 140, outstockMoney: 140, statementMoney: 140 }
        ],
        orders: {
          '门店A': [
            { noteKey: 'storeANote0801Id', day: '2026-08-01', status: '待发货', materialCnt: 4, orderMoney: 135 },
            { noteKey: 'storeANote0815Id', day: '2026-08-15', status: '待发货', materialCnt: 2, orderMoney: 170 }
          ],
          '门店B': [
            { noteKey: 'storeBNote0801Id', day: '2026-08-01', status: '待发货', materialCnt: 4, orderMoney: 135 },
            { noteKey: 'storeBNote0815Id', day: '2026-08-15', status: '待发货', materialCnt: 2, orderMoney: 14 }
          ],
          '门店C': [
            { noteKey: 'storeCNote0801Id', day: '2026-08-01', status: '已对账', materialCnt: 5, orderMoney: 150, statementMoney: 140 }
          ]
        },
        materials: {
          '门店A': [
            { noteKey: 'storeANote0801Id', name: '香蕉', unit: '包', orderCnt: 5, price: 10, orderMoney: 50 },
            { noteKey: 'storeANote0801Id', name: '苹果', unit: '包', orderCnt: 0.1, price: 200, orderMoney: 20 },
            { noteKey: 'storeANote0801Id', name: '葡萄', unit: '斤', orderCnt: 20, price: 1, orderMoney: 20 },
            { noteKey: 'storeANote0815Id', name: '西瓜', unit: '克', orderCnt: 500, price: 0.3, orderMoney: 150 },
            { noteKey: 'storeANote0815Id', name: '葡萄', unit: '斤', orderCnt: 20, price: 1, orderMoney: 20 }
          ],
          '门店B': [
            { noteKey: 'storeBNote0801Id', name: '香蕉', unit: '包', orderCnt: 5, price: 10, orderMoney: 50 },
            { noteKey: 'storeBNote0801Id', name: '葡萄', unit: '斤', orderCnt: 40, price: 0.5, orderMoney: 20 },
            { noteKey: 'storeBNote0815Id', name: '香蕉', unit: '包', orderCnt: 1, price: 10, orderMoney: 10 },
            { noteKey: 'storeBNote0815Id', name: '苹果', unit: '包', orderCnt: 0.02, price: 200, orderMoney: 4 }
          ],
          '门店C': [
            { noteKey: 'storeCNote0801Id', name: '葡萄', unit: '斤', orderCnt: 30, price: 0.5, orderMoney: 15, statementCnt: 30, statementMoney: 15 },
            { noteKey: 'storeCNote0801Id', name: '荔枝', unit: '斤', orderCnt: 4, price: 5, orderMoney: 20, statementCnt: 2, statementMoney: 10 }
          ]
        }
      }),
      this.buildSalesExcel({
        name: '销售情况仅08-01',
        remark: '只传begin，end补成同一天。门店A、B待发货，门店C已结算，荔枝发货为订货一半',
        begin: '2026-08-01',
        stores: [
          { name: '门店A', orderCnt: 1, status: salesStatus(0, 0, 0, 0, 1), orderMoney: 135 },
          { name: '门店B', orderCnt: 1, status: salesStatus(0, 0, 0, 0, 1), orderMoney: 135 },
          { name: '门店C', orderCnt: 1, status: salesStatus(0, 0, 0, 1), orderMoney: 150, sendMoney: 140, outstockMoney: 140, statementMoney: 140 }
        ],
        orders: {
          '门店A': [
            { noteKey: 'storeANote0801Id', day: '2026-08-01', status: '待发货', materialCnt: 4, orderMoney: 135 }
          ],
          '门店B': [
            { noteKey: 'storeBNote0801Id', day: '2026-08-01', status: '待发货', materialCnt: 4, orderMoney: 135 }
          ],
          '门店C': [
            { noteKey: 'storeCNote0801Id', day: '2026-08-01', status: '已对账', materialCnt: 5, orderMoney: 150, statementMoney: 140 }
          ]
        },
        materials: {
          '门店A': [
            { noteKey: 'storeANote0801Id', name: '香蕉', unit: '包', orderCnt: 5, price: 10, orderMoney: 50 }
          ],
          '门店B': [
            { noteKey: 'storeBNote0801Id', name: '葡萄', unit: '斤', orderCnt: 40, price: 0.5, orderMoney: 20 }
          ],
          '门店C': [
            { noteKey: 'storeCNote0801Id', name: '荔枝', unit: '斤', orderCnt: 4, price: 5, orderMoney: 20, statementCnt: 2, statementMoney: 10 }
          ]
        }
      }),
      this.buildSalesExcel({
        name: '销售情况仅08-15',
        remark: '只传begin=2026-08-15。门店C没有订单',
        begin: '2026-08-15',
        absentStores: ['门店C'],
        stores: [
          { name: '门店A', orderCnt: 1, status: salesStatus(0, 0, 0, 0, 1), orderMoney: 170 },
          { name: '门店B', orderCnt: 1, status: salesStatus(0, 0, 0, 0, 1), orderMoney: 14 }
        ],
        orders: {
          '门店A': [
            { noteKey: 'storeANote0815Id', day: '2026-08-15', status: '待发货', materialCnt: 2, orderMoney: 170 }
          ],
          '门店B': [
            { noteKey: 'storeBNote0815Id', day: '2026-08-15', status: '待发货', materialCnt: 2, orderMoney: 14 }
          ]
        },
        materials: {
          '门店A': [
            { noteKey: 'storeANote0815Id', name: '西瓜', unit: '克', orderCnt: 500, price: 0.3, orderMoney: 150 }
          ],
          '门店B': [
            { noteKey: 'storeBNote0815Id', name: '苹果', unit: '包', orderCnt: 0.02, price: 200, orderMoney: 4 }
          ]
        }
      }),
      this.buildPickerExcel()
    ];
  }

  /**
   * 新增分拣人后，将 usersWarehouse.isAdmin 设为 1
   */
  private setPickerAdmin(pickerKeys: string[]): BaseTest[] {
    return pickerKeys.map(key => new Action({
      name: `${key}设为管理员`,
      remark: `/free/update usersWarehouse isAdmin=1`,
      url: '/free/update',
      param: {
        table: 'usersWarehouse',
        cdts: [
          { col: 'usersId', val: `\${${key}UsersId}` },
          { col: 'warehouseId', val: '${supplierWarehouse.warehouseId}' }
        ],
        data: { isAdmin: 1 }
      }
    }));
  }

  /**
   * 门店A、B的订单走到拣货。08-15还在待接单，先接单再拣货。
   * 分拣甲拣门店A，分拣乙拣门店B的08-01，分拣丙拣门店B的08-15。
   */
  private buildPickOrders(): BaseTest[] {
    return [
      new ChangeToWarehouse('supplierWarehouse', '切换到供应商仓拣货'),
      ...this.pickBy('pickerA', [
        { noteKey: 'storeALinkNote0801Id', actions: ['pick'] },
        { noteKey: 'storeALinkNote0815Id', actions: ['accept', 'pick'] }
      ]),
      ...this.pickBy('pickerB', [
        { noteKey: 'storeBLinkNote0801Id', actions: ['pick'] }
      ]),
      ...this.pickBy('pickerC', [
        { noteKey: 'storeBLinkNote0815Id', actions: ['accept', 'pick'] }
      ])
    ];
  }

  private pickBy(pickerKey: string, notes: { noteKey: string; actions: string[] }[]): BaseTest[] {
    let steps: BaseTest[] = [new UseLogin(`${pickerKey}Token`)];
    for (let note of notes) {
      for (let action of note.actions) {
        steps.push(new Action({
          name: `${pickerKey} ${note.noteKey} ${action}`,
          remark: `${pickerKey}对${note.noteKey}执行${action}`,
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
          parseHttpParam(param, variable) {
            param.noteIds = [variable[note.noteKey]];
            return param;
          }
        }));
      }
    }
    return steps;
  }

  private buildPickerExcel(): CheckStatePickerExcel {
    return new CheckStatePickerExcel({
      name: '分拣记录08-01至08-15',
      remark: '分拣甲、分拣乙有昵称；分拣丙和创建人没有昵称，显示工蜂加用户id',
      begin: '2026-08-01',
      end: '2026-08-15',
      pickers: [
        { name: '分拣甲', times: 6, money: 305 },
        { name: '分拣乙', times: 4, money: 135 },
        { nameKey: 'pickerCUsersId', times: 2, money: 14 },
        { nameKey: 'mainUsersId', times: 5, money: 150 }
      ],
      rows: [
        {
          store: '门店A',
          noteKey: 'storeANote0801Id',
          material: '香蕉',
          unit: '包',
          orderCnt: 5,
          pickCnt: 5,
          pickMoney: 50,
          picker: '分拣甲'
        },
        {
          store: '门店B',
          noteKey: 'storeBNote0815Id',
          material: '苹果',
          unit: '包',
          orderCnt: 0.02,
          pickCnt: 0.02,
          pickMoney: 4,
          pickerKey: 'pickerCUsersId'
        }
      ]
    });
  }

  private buildPickerExcel0820(): CheckStatePickerExcel {
    return new CheckStatePickerExcel({
      name: '分拣记录08-20不含退货',
      remark: '门店A退货单不进入分拣汇总，只保留门店C已出库的订货单',
      begin: '2026-08-20',
      end: '2026-08-20',
      absentStores: ['门店A'],
      pickers: [
        { nameKey: 'pickerCUsersId', times: 1, money: 10 }
      ],
      rows: [
        {
          store: '门店C',
          noteKey: 'storeCNote0820Id',
          material: '荔枝',
          unit: '斤',
          orderCnt: 2,
          pickCnt: 2,
          sendCnt: 2,
          pickMoney: 10,
          pickerKey: 'pickerCUsersId'
        }
      ]
    });
  }

  private buildExcelCheck(opt: {
    name: string;
    remark: string;
    begin: string;
    end?: string;
    storeNames: string[];
    expects: MaterialExpect[];
    sendExpects: MaterialExpect[];
  }): CheckStateNote4SupplierExcel {
    return new CheckStateNote4SupplierExcel(opt);
  }

  private buildSalesExcel(opt: {
    name: string;
    remark: string;
    begin: string;
    end?: string;
    stores: SalesStoreExpect[];
    orders: { [storeName: string]: SalesOrderExpect[] };
    materials: { [storeName: string]: SalesMaterialExpect[] };
    absentStores?: string[];
  }): CheckStateSales4SupplierExcel {
    return new CheckStateSales4SupplierExcel(opt);
  }

  /**
   * 门店A退香蕉1瓶。供应商退货单时间改到 2026-08-20，避免冲掉前面正数订单的断言。
   */
  private buildBackBanana(): BaseTest[] {
    return [
      new ChangeToWarehouse('storeA', '切换到门店A退货'),
      new Action({
        name: '查询门店A的08-01明细',
        remark: '取香蕉 noteItem 作退货源',
        url: '/app/noteItem/listNoteItem',
        param: {
          noteId: '${storeANote0801Id}'
        }
      }, {
        warehouseType: 'storeA',
        buildVariable(result) {
          return { backSrcItems: result.result.content };
        }
      }),
      new Action({
        name: '门店A退香蕉1瓶',
        remark: '创建退货单，供应商侧生成 back4supplier',
        url: '/app/noteBack/createNoteBack',
        param: {
          warehouseId: '${storeA.warehouseId}'
        }
      }, {
        warehouseType: 'storeA',
        parseHttpParam(param: any, variable: any) {
          let bananaId = variable.storeAMaterials.香蕉.materialId;
          let src = (variable.backSrcItems ?? []).find((row: any) => row.materialId == bananaId);
          if (src == null) {
            throw new Error('未找到门店A香蕉明细');
          }
          param.items = [{
            noteItemId: src.noteItemId,
            stockUnitsId: src.stockUnitsId,
            cnt: 1,
            buyUnitFee: src.buyUnitFee,
            price: src.price,
            supplierId: src.supplierId,
            materialId: src.materialId,
            stockBuyUnitFee: src.stockBuyUnitFee
          }];
          return param;
        }
      }),
      new Action({
        name: '记下退货单',
        remark: '供应商退货单 id 在 linkNoteId',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${storeA.warehouseId}',
          status: 'instocked',
          type: 'back'
        }
      }, {
        warehouseType: 'storeA',
        buildVariable(result) {
          let row = result.result.content?.[0];
          CheckUtil.expectEqual(row != null, true, '应查到退货单');
          CheckUtil.expectEqual(row.linkNoteId != null && row.linkNoteId !== 0, true, '退货单应链接到供应商');
          return {
            storeBackNoteId: row.noteId,
            supplierBackNoteId: row.linkNoteId
          };
        }
      }),
      new Action({
        name: '修改供应商退货单时间为08-20',
        remark: '/free/update 供应商退货单 createTime=2026-08-20',
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [
            { col: 'noteId', val: '${supplierBackNoteId}' }
          ],
          data: { createTime: '2026-08-20 00:00:00' }
        }
      }),
      ...this.buildStoreCOutstock0820(),
      new ChangeToWarehouse('supplierWarehouse', '切换到供应商仓下载退货'),
      this.buildExcelCheck({
        name: '退货数量08-20',
        remark: '退货单香蕉订货为负数；发货sheet只有门店C荔枝，退货无发货数量',
        begin: '2026-08-20',
        end: '2026-08-20',
        storeNames: ['门店A', '门店C'],
        expects: [
          { name: '香蕉', unit: '包', total: -1, stores: { '门店A': -1, '门店C': '' } },
          { name: '荔枝', unit: '斤', total: 2, stores: { '门店A': '', '门店C': 2 } }
        ],
        sendExpects: [
          { name: '荔枝', unit: '斤', total: 2, stores: { '门店A': '', '门店C': 2 } }
        ]
      }),
      this.buildSalesExcel({
        name: '退货销售情况08-20',
        remark: '门店A退货未对账为负数；门店C订货已出库，发货和出库与订货相同，对账为空',
        begin: '2026-08-20',
        end: '2026-08-20',
        stores: [
          { name: '门店A', orderCnt: 1, status: salesStatus(0, 0, 1), orderMoney: -10, outstockMoney: -10 },
          { name: '门店C', orderCnt: 1, status: salesStatus(0, 0, 1), orderMoney: 10, sendMoney: 10, outstockMoney: 10 }
        ],
        orders: {
          '门店A': [
            {
              noteKey: 'storeBackNoteId',
              day: '2026-08-20',
              status: '未对账',
              typeName: '退货单',
              materialCnt: 1,
              orderMoney: -10,
              outstockMoney: -10
            }
          ],
          '门店C': [
            {
              noteKey: 'storeCNote0820Id',
              day: '2026-08-20',
              status: '未对账',
              materialCnt: 1,
              orderMoney: 10,
              sendMoney: 10,
              outstockMoney: 10
            }
          ]
        },
        materials: {
          '门店A': [
            {
              noteKey: 'storeBackNoteId',
              name: '香蕉',
              unit: '包',
              orderCnt: -1,
              price: 10,
              orderMoney: -10,
              outstockCnt: -1,
              outstockMoney: -10
            }
          ],
          '门店C': [
            {
              noteKey: 'storeCNote0820Id',
              name: '荔枝',
              unit: '斤',
              orderCnt: 2,
              price: 5,
              orderMoney: 10,
              sendCnt: 2,
              sendMoney: 10,
              outstockCnt: 2,
              outstockMoney: 10
            }
          ]
        }
      }),
      this.buildPickerExcel0820()
    ];
  }

  private buildStoreCOutstock0820(): BaseTest[] {
    const store = STORES[2];
    const key = store.key;
    const idKey = 'storeCNote0820Id';
    const linkIdKey = 'storeCLinkNote0820Id';
    const actions = ['accept', 'pick', 'send', 'outstock'] as const;
    const titles = { accept: '接单', pick: '拣货', send: '发货', outstock: '出库' };
    return [
      new ChangeToWarehouse(key, '切换到门店C发08-20单'),
      new CreateStoreNote(store, store.items0820, idKey, '门店C08-20下单'),
      new Action({
        name: '门店C发送08-20订单',
        remark: '已链接，发单后供应商订单为待接单',
        url: '/app/note/sendNote',
        method: 'POST',
        param: {
          noteIds: `\${${idKey}s}`,
          status: 'normal',
          warehouseId: `\${${key}.warehouseId}`,
          warehouseGroupId: `\${${key}.warehouseGroupId}`
        }
      }),
      new QueryAction({
        name: '门店C记下08-20链接单',
        url: '/app/note/listNote',
        query: {
          noteId: `\${${idKey}}`
        }
      }, {
        warehouseType: 'storeC',
        buildVariable(result) {
          const row = (result.result.content ?? [])[0];
          CheckUtil.expectEqual(row?.linkNoteId != null && row.linkNoteId !== 0, true, '门店C08-20缺少 linkNoteId');
          return {
            [linkIdKey]: row.linkNoteId
          };
        }
      }).setRemark('记下08-20供应商订单id'),
      new Action({
        name: '修改门店C供应商订单时间为08-20',
        remark: '/free/update 供应商订单 createTime=2026-08-20',
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [
            { col: 'noteId', val: `\${${linkIdKey}}` }
          ],
          data: { createTime: '2026-08-20 00:00:00' }
        }
      }),
      new ChangeToWarehouse('supplierWarehouse', '切换到供应商仓出库门店C08-20'),
      ...actions.map(action => new Action({
        name: `门店C08-20${titles[action]}`,
        remark: `供应商将门店C的08-20订单${titles[action]}`,
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
        parseHttpParam(param, variable) {
          param.noteIds = [variable[linkIdKey]];
          return param;
        }
      }))
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
        remark: '供应商仓增加水果分类',
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
        { name: '克', fee: 1 },
        { name: '包', fee: 1000, isSupplier: true }
      ], 'supplierCategoryId'),
      this.saveMaterial('supplierWarehouse', '苹果', [
        { name: '斤', fee: 1 },
        { name: '包', fee: 10, isSupplier: true }
      ], 'supplierCategoryId'),
      this.saveMaterial('supplierWarehouse', '西瓜', [
        { name: '包', fee: 1, isSupplier: true }
      ], 'supplierCategoryId'),
      this.saveMaterial('supplierWarehouse', '荔枝', [
        { name: '斤', fee: 1, isSupplier: true }
      ], 'supplierCategoryId'),
      this.listMaterials('supplierWarehouse', '供应商读取物料')
    ];
  }

  private buildStore(store: StoreDef): BaseTest[] {
    const key = store.key;
    const supplierIdVar = `${key}SupplierId`;
    const categoryIdVar = `${key}CategoryId`;
    return [
      new AddWarehouse({
        name: store.title,
        type: 'store',
        variableType: key
      }).setRemark(`创建${store.title}`),
      new ChangeToWarehouse(key, `切换到${store.title}`),
      new Action({
        name: `${store.title}新增分类`,
        remark: `${store.title}增加水果分类`,
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
        remark: `${store.title}增加供应商「${SUPPLIER_NAME}」`,
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
        { name: '克', fee: 1 },
        { name: store.bananaUnit, fee: 1000, isSupplier: true }
      ], categoryIdVar, supplierIdVar, 10),
      this.saveMaterial(key, '苹果', [
        { name: '袋', fee: 1, isSupplier: true },
        { name: '斤', fee: 10 }
      ], categoryIdVar, supplierIdVar, 2),
      this.saveMaterial(key, '西瓜', [
        { name: '包', fee: 1, isSupplier: true }
      ], categoryIdVar, supplierIdVar, 3),
      this.saveMaterial(key, '葡萄', [
        { name: store.grapeUnit, fee: 1, isSupplier: true }
      ], categoryIdVar, supplierIdVar, 1),
      ...(store.lycheeUnit ? [this.saveMaterial(key, '荔枝', [
        { name: store.lycheeUnit, fee: 1, isSupplier: true }
      ], categoryIdVar, supplierIdVar, 10)] : []),
      this.listMaterials(key, `${store.title}读取物料`)
    ];
  }

  private buildOrder0801(store: StoreDef): BaseTest[] {
    const key = store.key;
    const idKey = `${key}Note0801Id`;
    return [
      new ChangeToWarehouse(key, `切换到${store.title}发08-01单`),
      new CreateStoreNote(store, store.items0801, idKey, `${store.title}08-01下单`),
      new Action({
        name: `${store.title}发送08-01订单`,
        remark: `${store.title} sendNote，状态 normal`,
        url: '/app/note/sendNote',
        method: 'POST',
        param: {
          noteIds: `\${${idKey}s}`,
          status: 'normal',
          warehouseId: `\${${key}.warehouseId}`,
          warehouseGroupId: `\${${key}.warehouseGroupId}`
        }
      })
    ];
  }

  private buildLink(store: StoreDef, day: string): BaseTest[] {
    const key = store.key;
    const warehouseType = key as IOpt['warehouseType'];
    const noteIdKey = `${key}Note0801Id`;
    const linkIdKey = `${key}LinkNote0801Id`;
    return [
      new SaveShareData({
        data: {
          noteId: `\${${noteIdKey}}`
        }
      }).setRemark(`${store.title}保存分享`),
      new Action({
        url: '/share/shareNote',
        name: `${store.title}查询分享单`,
        remark: `${store.title}按 shareDataNo 拉分享单`,
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
        remark: `供应商接单 ${store.title} 08-01订单`,
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
          noteId: `\${${noteIdKey}}`
        }
      }, {
        warehouseType,
        buildVariable(result) {
          const row = (result.result.content ?? [])[0];
          CheckUtil.expectEqual(row?.linkNoteId != null && row.linkNoteId !== 0, true, `${store.title}缺少 linkNoteId`);
          return {
            [linkIdKey]: row.linkNoteId
          };
        }
      }).setRemark(`${store.title}记下供应商订单id`),
      new Action({
        name: `${store.title}修改供应商订单时间为${day}`,
        remark: `/free/update 供应商订单 createTime=${day}`,
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [
            { col: 'noteId', val: `\${${linkIdKey}}` }
          ],
          data: { createTime: `${day} 00:00:00` }
        }
      })
    ];
  }

  private buildStoreCStatement(): BaseTest[] {
    return [
      new ChangeToWarehouse('supplierWarehouse', '切换到供应商仓结算门店C'),
      new Action({
        name: '门店C拣货',
        remark: '供应商将门店C的08-01订单拣货',
        url: '/app/note/batchProcessNote',
        method: 'POST',
        param: {
          action: 'pick',
          noteIds: [],
          type: 'send',
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
        }
      }, {
        parseHttpParam(param, variable) {
          param.noteIds = [variable.storeCLinkNote0801Id];
          return param;
        }
      }),
      new Action({
        name: '查询门店C08-01明细',
        remark: '发货前读取明细，荔枝发货数量改为订货一半',
        url: '/app/noteItem/listNoteItem',
        param: {
          noteId: '${storeCLinkNote0801Id}'
        }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          return { storeCLinkNote0801Items: result.result.content };
        }
      }),
      new Action({
        name: '门店C发货(荔枝减半)',
        remark: '荔枝发货=订货一半，制造订货数量≠发货数量场景',
        url: '/app/note/processNote',
        method: 'POST',
        param: {
          noteId: '${storeCLinkNote0801Id}',
          noteItems: '${storeCLinkNote0801Items}',
          action: 'send',
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
        }
      }, {
        parseHttpParam(param, variable) {
          let noteItems = NoteItemUtil.change(param.noteItems);
          let lycheeId = variable.supplierWarehouseMaterials?.['荔枝']?.materialId;
          for (let item of noteItems) {
            if (String(item.materialId) === String(lycheeId)) {
              item.sendCnt = Number(item.cnt) / 2;
            } else {
              item.sendCnt = item.cnt;
            }
          }
          param.noteItems = noteItems;
          return param;
        }
      }),
      ...(['outstock', 'statement'] as const).map(action => new Action({
        name: `门店C${action === 'outstock' ? '出库' : '结算'}`,
        remark: `供应商将门店C的08-01订单${action === 'outstock' ? '出库' : '结算'}`,
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
        parseHttpParam(param, variable) {
          param.noteIds = [variable.storeCLinkNote0801Id];
          return param;
        }
      }))
    ];
  }

  private buildUpdateWatermelon(): BaseTest[] {
    return [
      new ChangeToWarehouse('supplierWarehouse', '切换到供应商仓改西瓜规格'),
      new Action({
        name: '供应商西瓜改为1包=1000g',
        remark: '供应商西瓜规格改为克+包(1000)',
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${supplierWarehouseMaterials.西瓜.materialId}',
          name: '西瓜',
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 1000, isSupplier: true }
          ],
          suppliers: [],
          category: { categoryId: '${supplierCategoryId}' },
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}'
        }
      }),
      this.listMaterials('supplierWarehouse', '供应商改规格后读取物料'),
      new ChangeToWarehouse('storeA', '切换到门店A改西瓜规格'),
      new Action({
        name: '门店A西瓜改为1包=1000g',
        remark: '门店A西瓜规格改为克+包(1000)',
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${storeAMaterials.西瓜.materialId}',
          name: '西瓜',
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 1000, isSupplier: true }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${storeASupplierId}',
            price: 3
          }],
          category: { categoryId: '${storeACategoryId}' },
          warehouseId: '${storeA.warehouseId}',
          warehouseGroupId: '${storeA.warehouseGroupId}'
        }
      }),
      this.listMaterials('storeA', '门店A改规格后读取物料')
    ];
  }

  private buildOrder0815(store: StoreDef): BaseTest[] {
    if (store.items0815 == null) {
      return [];
    }
    const key = store.key;
    const warehouseType = key as IOpt['warehouseType'];
    const idKey = `${key}Note0815Id`;
    const linkIdKey = `${key}LinkNote0815Id`;
    return [
      new ChangeToWarehouse(key, `切换到${store.title}发08-15单`),
      new CreateStoreNote(store, store.items0815, idKey, `${store.title}08-15下单`),
      new Action({
        name: `${store.title}发送08-15订单`,
        remark: `${store.title} sendNote，已链接无需再接单`,
        url: '/app/note/sendNote',
        method: 'POST',
        param: {
          noteIds: `\${${idKey}s}`,
          status: 'normal',
          warehouseId: `\${${key}.warehouseId}`,
          warehouseGroupId: `\${${key}.warehouseGroupId}`
        }
      }),
      new QueryAction({
        name: `${store.title}记下08-15链接单`,
        url: '/app/note/listNote',
        query: {
          noteId: `\${${idKey}}`
        }
      }, {
        warehouseType,
        buildVariable(result) {
          const row = (result.result.content ?? [])[0];
          CheckUtil.expectEqual(row?.linkNoteId != null && row.linkNoteId !== 0, true, `${store.title}08-15缺少 linkNoteId`);
          return {
            [linkIdKey]: row.linkNoteId
          };
        }
      }).setRemark(`${store.title}记下08-15供应商订单id`),
      new Action({
        name: `${store.title}修改08-15供应商订单时间`,
        remark: `/free/update 供应商订单 createTime=2026-08-15`,
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [
            { col: 'noteId', val: `\${${linkIdKey}}` }
          ],
          data: { createTime: '2026-08-15 00:00:00' }
        }
      })
    ];
  }

  private listMaterials(warehouseKey: string, title: string): BaseTest {
    return new Action({
      name: title,
      remark: title,
      url: '/app/material/listMaterialByCategory',
      method: 'POST',
      param: {
        warehouseId: `\${${warehouseKey}.warehouseId}`,
        warehouseGroupId: `\${${warehouseKey}.warehouseGroupId}`
      }
    }, {
      warehouseType: warehouseKey as IOpt['warehouseType'],
      buildVariable(result) {
        return {
          [`${warehouseKey}Materials`]: ArrayUtil.toMapByKey(result.result.content ?? [], 'name')
        };
      }
    });
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
      remark: `${warehouseKey}增加${name}`,
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

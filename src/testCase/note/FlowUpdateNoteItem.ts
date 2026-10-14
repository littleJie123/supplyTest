import { BaseTest, CheckUtil, DateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import AddMaterial from "../../action/material/AddMaterial";
import ListMaterial from "../../action/material/ListMaterial";
import SaveMaterial from "../../action/material/SaveMaterial";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import QueryAction from "../../action/QueryAction";
import Action from "../../action/Action";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import ChangeWarehouse2Supplier from "../../action/user/ChangeWarehouse2Supplier";
import SaveShareData from "../../action/shareData/SaveShareData";
import StockUtil from "../../util/StockUtil";
import { WarehouseType } from "../../inf/IOpt";

/** 单价 10 元/包。金额 = 包数 × 10。3包50g = 3.5包。 */
const PRICE = 10;

interface Qty {
  cnt: number;
  buyUnitFee: number;
}

interface Price {
  price: number;
  buyUnitFee: number;
}

interface ItemExpect {
  name: string;
  purcharse?: Qty;
  pick?: Qty;
  send?: Qty;
  instock?: Qty;
  outstock?: Qty;
  statement?: Qty;
  /** 不传则仍是 10 元/包 */
  price?: Price;
  /** 不传则不校验备注 */
  remark?: string;
}

interface EditLine {
  name: string;
  cnt: Qty;
  /** 不传则不改单价 */
  price?: Price;
  /** 不传则不改备注 */
  remark?: string;
}

interface AddLine {
  name: string;
  cnt: Qty;
  mapKey: string;
  /** 不传则备注为空 */
  remark?: string;
}

function shiftDay(days: number): string {
  let text = DateUtil.todayStr();
  let date = new Date(text + ' 00:00:00');
  date.setDate(date.getDate() + days);
  let month = String(date.getMonth() + 1).padStart(2, '0');
  let day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayOf(value: any): string {
  if (value == null || value === '') {
    return '';
  }
  let time = value;
  if (typeof value === 'number' && value < 1e12) {
    time = value * 1000;
  }
  let date = new Date(time);
  let month = String(date.getMonth() + 1).padStart(2, '0');
  let day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 整包，buyUnitFee=1 */
function pack(cnt: number): Qty {
  return { cnt, buyUnitFee: 1 };
}

/** 1包=100g。3包50g → cnt=350, buyUnitFee=100 */
function gram(packs: number, grams: number): Qty {
  return { cnt: packs * 100 + grams, buyUnitFee: 100 };
}

function yuan(packs: number): number {
  return Math.round(packs * PRICE * 100) / 100;
}

function findItem(items: any[], name: string) {
  let row = (items ?? []).find(item => item.name === name);
  if (row == null) {
    throw new Error(`订单物料里没有${name}`);
  }
  return row;
}

function checkQty(row: any, field: string, expect: Qty, name: string) {
  if (expect == null) {
    return;
  }
  let actual = row[field] ?? { cnt: 0, buyUnitFee: 1 };
  CheckUtil.expectEqual(
    StockUtil.isEq(
      { cnt: actual.cnt ?? 0, buyUnitFee: actual.buyUnitFee ?? 1 },
      expect
    ),
    true,
    `${name}.${field} 实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expect)}`
  );
}

function checkItems(content: any[], items: ItemExpect[], title: string) {
  CheckUtil.expectEqual(
    content.length,
    items.length,
    `${title}物料条数应为${items.length}，实际${content.length}`
  );
  for (let expect of items) {
    let row = content.find(item => item.name === expect.name);
    CheckUtil.expectEqual(row != null, true, `${title}缺少${expect.name}`);
    CheckUtil.expectEqual(
      StockUtil.isEqPrice(
        {
          price: row.supplierMaterial?.price,
          buyUnitFee: row.supplierMaterial?.buyUnitFee
        },
        expect.price ?? { price: PRICE, buyUnitFee: 1 }
      ),
      true,
      `${expect.name}价格不对 ${JSON.stringify(row.supplierMaterial)}`
    );
    checkQty(row, 'purcharse', expect.purcharse, expect.name);
    checkQty(row, 'pick', expect.pick, expect.name);
    checkQty(row, 'sendCnt', expect.send, expect.name);
    checkQty(row, 'instock', expect.instock, expect.name);
    checkQty(row, 'outstock', expect.outstock, expect.name);
    checkQty(row, 'statementCnt', expect.statement, expect.name);
    if (expect.remark != null) {
      CheckUtil.expectEqual(row.remark, expect.remark, `${expect.name}备注`);
    }
  }
}

function hisPrice(data: any) {
  return {
    price: data?.price,
    buyUnitFee: data?.stockBuyUnitFee ?? data?.buyUnitFee
  };
}

function hisCnt(data: any, col: string) {
  return {
    cnt: data?.[col] ?? 0,
    buyUnitFee: data?.buyUnitFee ?? 1
  };
}

/** 入库修改后的 updateNoteItem 历史：改价改量、只改量、删除、新增 */
function checkInstockUpdateHis(rows: any[], materialMap: any) {
  CheckUtil.expectEqual(rows.length, 8, `修改历史应为8条，实际${rows.length}`);
  for (let row of rows) {
    CheckUtil.expectEqual(row.action, 'updateNoteItem', 'action');
    CheckUtil.expectEqual(row.tableName, 'noteItem', 'tableName');
    CheckUtil.expectEqual(row.parentTable, 'note', 'parentTable');
  }
  let ofMaterial = (name: string) => rows.filter(row =>
    String(row.data?.newData?.materialId) === String(materialMap[name].materialId)
  );
  let banana = ofMaterial('香蕉').find(row =>
    StockUtil.isEqPrice(hisPrice(row.data?.newData), { price: 20, buyUnitFee: 1 })
  );
  CheckUtil.expectEqual(banana != null, true, '应有香蕉改价历史');
  CheckUtil.expectEqual(
    StockUtil.isEqPrice(hisPrice(banana.data.oldData), { price: 10, buyUnitFee: 1 }),
    true,
    `香蕉原价 ${JSON.stringify(hisPrice(banana.data.oldData))}`
  );
  CheckUtil.expectEqual(
    StockUtil.isEq(hisCnt(banana.data.oldData, 'instockCnt'), { cnt: 3, buyUnitFee: 1 }),
    true,
    '香蕉原入库数量'
  );
  CheckUtil.expectEqual(
    StockUtil.isEq(hisCnt(banana.data.newData, 'instockCnt'), { cnt: 3.5, buyUnitFee: 1 }),
    true,
    '香蕉新入库数量'
  );
  let detail = String(banana.data?.detail ?? '');
  CheckUtil.expectEqual(detail.indexOf('原来') >= 0 && detail.indexOf('新') >= 0, true, `香蕉明细 ${detail}`);
  CheckUtil.expectEqual(detail.indexOf('价格') >= 0 && detail.indexOf('数量') >= 0, true, `香蕉明细应含价格和数量 ${detail}`);
  CheckUtil.expectEqual(banana.data?.remark, '修改订单物料:香蕉', '历史备注不写客户端备注');

  let grape = ofMaterial('葡萄').find(row => row.data?.oldData != null);
  CheckUtil.expectEqual(grape != null, true, '应有葡萄修改历史');
  CheckUtil.expectEqual(
    StockUtil.isEq(hisCnt(grape.data.oldData, 'instockCnt'), { cnt: 4, buyUnitFee: 1 })
      && StockUtil.isEq(hisCnt(grape.data.newData, 'instockCnt'), { cnt: 4, buyUnitFee: 1 }),
    true,
    '葡萄入库数量未改'
  );
  CheckUtil.expectEqual(
    StockUtil.isEqPrice(hisPrice(grape.data.newData), { price: 10, buyUnitFee: 1 }),
    true,
    '葡萄价格未改'
  );

  let tomato = ofMaterial('番茄').find(row => row.data?.newData?.isDel == 1);
  CheckUtil.expectEqual(tomato != null, true, '应有番茄删除历史');
  CheckUtil.expectEqual(
    StockUtil.isEq(hisCnt(tomato.data.oldData, 'instockCnt'), { cnt: 5, buyUnitFee: 1 }),
    true,
    '番茄删除前入库数量'
  );

  let apple = ofMaterial('苹果').find(row => row.data?.oldData == null && row.data?.newData?.isDel != 1);
  CheckUtil.expectEqual(apple != null, true, '应有苹果新增历史');
  CheckUtil.expectEqual(
    StockUtil.isEq(hisCnt(apple.data.newData, 'instockCnt'), { cnt: 2, buyUnitFee: 1 }),
    true,
    '苹果新增入库数量'
  );
  CheckUtil.expectEqual(
    StockUtil.isEqPrice(hisPrice(apple.data.newData), { price: 10, buyUnitFee: 1 }),
    true,
    '苹果新增价格'
  );
  CheckUtil.expectEqual(apple.data?.remark, '修改订单物料:苹果', '历史备注不写客户端备注');
}

function savePackSpec(name: string, mapKey: string, warehouseKey: WarehouseType): Action {
  return new Action({
    name: `${name}规格1包=100g`,
    url: '/app/material/saveBuyUnit',
    method: 'POST',
    param: {
      materialId: `\${${mapKey}.${name}.materialId}`,
      warehouseId: `\${${warehouseKey}.warehouseId}`,
      warehouseGroupId: `\${${warehouseKey}.warehouseGroupId}`,
      buyUnit: [
        { name: '克', fee: 1 },
        { name: '包', fee: 100, isSupplier: true }
      ],
      supplierUnitsName: '包'
    }
  }, {
    warehouseType: warehouseKey
  });
}

function storeMaterial(name: string): AddMaterial {
  return new AddMaterial(name, {
    buyUnit: [{ name: '包', fee: 1, isSupplier: true }],
    suppliers: [{
      isDef: true,
      supplierId: '${supplierMap.供应商1}',
      price: PRICE
    }]
  });
}

function createOrder(name: string, lines: { name: string, packs: number }[], noteVar: string): Action {
  return new Action({
    name,
    url: '/app/note/createNote',
    method: 'POST',
    param: {
      items: lines.map(line => ({
        materialId: `\${materialMap.${line.name}.materialId}`,
        supplierId: '${supplierMap.供应商1}',
        cnt: line.packs,
        buyUnitFee: 1,
        stockUnitsId: 0,
        price: PRICE,
        stockBuyUnitFee: 1
      })),
      warehouseId: '${warehouse.warehouseId}',
      warehouseGroupId: '${warehouse.warehouseGroupId}'
    }
  }, {
    buildVariable(result) {
      let noteId = result.result[0].noteId;
      return {
        [noteVar]: noteId,
        noteIds: [noteId]
      };
    }
  });
}

function sendOrder(name: string): Action {
  return new Action({
    name,
    url: '/app/note/sendNote',
    method: 'POST',
    param: {
      noteIds: '${noteIds}',
      status: 'normal',
      warehouseId: '${warehouse.warehouseId}',
      warehouseGroupId: '${warehouse.warehouseGroupId}'
    }
  });
}

function loadItems(name: string, noteVar: string, warehouseKey: WarehouseType): QueryAction {
  return new QueryAction({
    name,
    url: '/app/noteItem/listNoteItem',
    query: {
      noteId: `\${${noteVar}}`
    }
  }, {
    warehouseType: warehouseKey,
    buildVariable(result) {
      return {
        noteItems: result.result.content
      };
    }
  });
}

function checkOrder(opt: {
  name: string;
  noteVar: string;
  warehouseKey: WarehouseType;
  materialCnt: number;
  moneyCol: string;
  money: number;
  items: ItemExpect[];
}): BaseTest[] {
  return [
    new QueryAction({
      name: `${opt.name}订单`,
      url: '/app/note/listNote',
      query: {
        noteId: `\${${opt.noteVar}}`
      }
    }, {
      warehouseType: opt.warehouseKey,
      check(result) {
        let row = result.result.content[0];
        CheckUtil.expectEqual(row.materialCnt, opt.materialCnt, `${opt.name}物料数量`);
        CheckUtil.expectEqual(Number(row[opt.moneyCol]), opt.money, `${opt.name}${opt.moneyCol}`);
      }
    }),
    new QueryAction({
      name: `${opt.name}物料`,
      url: '/app/noteItem/listNoteItem',
      query: {
        noteId: `\${${opt.noteVar}}`
      }
    }, {
      warehouseType: opt.warehouseKey,
      buildVariable(result) {
        return {
          noteItems: result.result.content
        };
      },
      check(result) {
        checkItems(result.result.content, opt.items, opt.name);
      }
    })
  ];
}

function updateItems(opt: {
  name: string;
  noteVar: string;
  warehouseKey: WarehouseType;
  highlight?: boolean;
  remark?: string;
  updates?: EditLine[];
  adds?: AddLine[];
  dels?: string[];
}): Action {
  return new Action({
    name: opt.name,
    remark: opt.remark,
    url: '/app/noteItem/updateNoteItem',
    method: 'POST',
    highlight: opt.highlight,
    param: {
      noteId: `\${${opt.noteVar}}`,
      warehouseId: `\${${opt.warehouseKey}.warehouseId}`,
      warehouseGroupId: `\${${opt.warehouseKey}.warehouseGroupId}`,
      datas: {}
    }
  }, {
    warehouseType: opt.warehouseKey,
    parseHttpParam(param, variable) {
      let items: any[] = variable.noteItems ?? [];
      let datas: any = {};
      if (opt.updates != null) {
        datas.update = opt.updates.map(row => {
          let item: any = {
            noteItemId: findItem(items, row.name).noteItemId,
            cnt: row.cnt
          };
          if (row.price != null) {
            item.price = row.price;
          }
          if (row.remark != null) {
            item.remark = row.remark;
          }
          return item;
        });
      }
      if (opt.adds != null) {
        datas.add = opt.adds.map(row => {
          let item: any = {
            materialId: variable[row.mapKey][row.name].materialId,
            cnt: row.cnt,
            price: { price: PRICE, buyUnitFee: 1 }
          };
          if (row.remark != null) {
            item.remark = row.remark;
          }
          return item;
        });
      }
      if (opt.dels != null) {
        datas.del = opt.dels.map(name => ({
          noteItemId: findItem(items, name).noteItemId
        }));
      }
      param.datas = datas;
      return param;
    }
  });
}

function processNote(
  name: string,
  noteVar: string,
  action: string,
  warehouseKey: WarehouseType,
  type?: string
): Action {
  let param: any = {
    action,
    noteIds: [],
    warehouseId: `\${${warehouseKey}.warehouseId}`,
    warehouseGroupId: `\${${warehouseKey}.warehouseGroupId}`
  };
  if (type != null) {
    param.type = type;
  }
  return new Action({
    name,
    url: '/app/note/batchProcessNote',
    method: 'POST',
    param
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(httpParam, variable) {
      httpParam.noteIds = [variable[noteVar]];
      return httpParam;
    }
  });
}

/** 改完库存流水后重算，stock 表才会变成最新数量。 */
function recalStock(name: string, warehouseKey: WarehouseType): Action {
  return new Action({
    name,
    url: '/free/script/recalStockRecordByWarehouse',
    method: 'POST',
    param: {
      warehouseId: `\${${warehouseKey}.warehouseId}`,
      warehouseGroupId: `\${${warehouseKey}.warehouseGroupId}`
    }
  });
}

function stockStep(
  name: string,
  warehouseKey: WarehouseType,
  mapKey: string,
  variable: any,
  lines: { name: string, cnt: number }[]
): Action {
  return new Action({
    name,
    url: '/free/query',
    param: {
      array: [{
        table: 'stock',
        query: {
          warehouseId: `\${${warehouseKey}.warehouseId}`,
          warehouseGroupId: `\${${warehouseKey}.warehouseGroupId}`,
          isDel: 0
        }
      }]
    }
  }, {
    check(result) {
      let rows: any[] = result.result?.stock ?? [];
      for (let line of lines) {
        let materialId = variable[mapKey][line.name].materialId;
        let row = rows.find(item => String(item.materialId) === String(materialId));
        let actual = row == null
          ? { cnt: 0, buyUnitFee: 1 }
          : { cnt: row.cnt ?? 0, buyUnitFee: row.buyUnitFee ?? 1 };
        let expect = { cnt: line.cnt, buyUnitFee: 1 };
        CheckUtil.expectEqual(
          StockUtil.isEq(actual, expect),
          true,
          `${line.name}库存 实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expect)}`
        );
      }
    }
  });
}

/**
 * 餐厅：改订货、入库、结算。
 * 供应商：待接单到结算。接单改的是订货数量。发货才动库存。
 * 修改物料接口只高亮入库后那一次。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '更改订单物料：餐厅订货/入库/结算，供应商待接单到结算' });
  }

  getName(): string {
    return '更改订单物料';
  }

  protected buildActions(): BaseTest[] {
    let variable = this.getVariable();
    let today = DateUtil.todayStr();
    let day3 = shiftDay(-3);
    let day10 = shiftDay(-10);
    let supplierStock = [
      { name: '白菜', cnt: 96.5 },
      { name: '黄瓜', cnt: 98 },
      { name: '土豆', cnt: 98 },
      { name: '萝卜', cnt: 100 }
    ];
    return [
      new PreTest({
        materialsOpts: [
          { name: '猪肉', category: '肉类', unit: '斤' }
        ]
      }),
      ...this.restaurant(variable, day3),
      ...this.supplierPrepare(variable, today, day10),
      ...this.linkAndSend(),
      ...this.supplierFlow(variable, day3, supplierStock)
    ];
  }

  private restaurant(variable: any, day3: string): BaseTest[] {
    return [
      storeMaterial('香蕉'),
      storeMaterial('苹果'),
      storeMaterial('葡萄'),
      storeMaterial('番茄'),
      new ListMaterial(),
      savePackSpec('香蕉', 'materialMap', 'warehouse'),

      createOrder('发送订单：香蕉2包苹果3包', [
        { name: '香蕉', packs: 2 },
        { name: '苹果', packs: 3 }
      ], 'storeNoteId'),
      sendOrder('发送餐厅订单'),
      loadItems('读取订货物料', 'storeNoteId', 'warehouse'),
      updateItems({
        name: '修改订货数量',
        noteVar: 'storeNoteId',
        warehouseKey: 'warehouse',
        updates: [{ name: '香蕉', cnt: pack(3) }],
        dels: ['苹果'],
        adds: [
          { name: '葡萄', cnt: pack(4), mapKey: 'materialMap' },
          { name: '番茄', cnt: pack(5), mapKey: 'materialMap' }
        ]
      }),
      ...checkOrder({
        name: '订货修改后',
        noteVar: 'storeNoteId',
        warehouseKey: 'warehouse',
        materialCnt: 3,
        moneyCol: 'cost',
        money: yuan(3 + 4 + 5),
        items: [
          { name: '香蕉', purcharse: pack(3) },
          { name: '葡萄', purcharse: pack(4) },
          { name: '番茄', purcharse: pack(5) }
        ]
      }),

      processNote('入库', 'storeNoteId', 'instock', 'warehouse', 'purcharse'),
      stockStep('入库后库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 3 },
        { name: '葡萄', cnt: 4 },
        { name: '番茄', cnt: 5 }
      ]),
      new Action({
        name: '入库时间改成3天前',
        url: '/app/note/updateNoteTime',
        method: 'POST',
        param: {
          noteId: '${storeNoteId}',
          sysAddTime: `${day3} 12:00:00`,
          lastUpdateTime: `${day3} 12:00:00`,
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),
      loadItems('读取入库物料', 'storeNoteId', 'warehouse'),
      updateItems({
        name: '修改入库数量',
        remark: 'POST /app/noteItem/updateNoteItem。改香蕉数量和单价，改葡萄，删除番茄，新增苹果',
        noteVar: 'storeNoteId',
        warehouseKey: 'warehouse',
        highlight: true,
        updates: [
          { name: '香蕉', cnt: gram(3, 50), price: { price: 20, buyUnitFee: 1 }, remark: '香蕉改入库' },
          { name: '葡萄', cnt: pack(4) }
        ],
        dels: ['番茄'],
        adds: [{ name: '苹果', cnt: pack(2), mapKey: 'materialMap', remark: '新增苹果' }]
      }),
      new QueryAction({
        name: '查询入库修改历史',
        url: '/app/updateHis/listUpdateHis',
        query: {
          parentId: '${storeNoteId}',
          parentTable: 'note',
          tableName: 'noteItem',
          action: 'updateNoteItem'
        }
      }, {
        check(result) {
          checkInstockUpdateHis(result.result.content ?? [], variable.materialMap);
        }
      }),
      ...checkOrder({
        name: '入库修改后',
        noteVar: 'storeNoteId',
        warehouseKey: 'warehouse',
        materialCnt: 3,
        moneyCol: 'instockCost',
        money: 3.5 * 20 + 4 * PRICE + 2 * PRICE,
        items: [
          { name: '香蕉', purcharse: pack(3), instock: gram(3, 50), price: { price: 20, buyUnitFee: 1 }, remark: '香蕉改入库' },
          { name: '葡萄', purcharse: pack(4), instock: pack(4) },
          { name: '苹果', purcharse: pack(0), instock: pack(2), remark: '新增苹果' }
        ]
      }),
      recalStock('重算入库库存', 'warehouse'),
      stockStep('入库修改后库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 3.5 },
        { name: '葡萄', cnt: 4 },
        { name: '苹果', cnt: 2 },
        { name: '番茄', cnt: 0 }
      ]),

      processNote('结算餐厅订单', 'storeNoteId', 'statement', 'warehouse'),
      loadItems('读取结算物料', 'storeNoteId', 'warehouse'),
      updateItems({
        name: '修改结算数量',
        noteVar: 'storeNoteId',
        warehouseKey: 'warehouse',
        updates: [{ name: '香蕉', cnt: gram(4, 50) }],
        dels: ['苹果', '葡萄'],
        adds: [{ name: '番茄', cnt: pack(1), mapKey: 'materialMap' }]
      }),
      ...checkOrder({
        name: '结算修改后',
        noteVar: 'storeNoteId',
        warehouseKey: 'warehouse',
        materialCnt: 2,
        moneyCol: 'statementCost',
        money: 4.5 * 20 + 1 * PRICE,
        items: [
          { name: '香蕉', statement: gram(4, 50), price: { price: 20, buyUnitFee: 1 }, remark: '香蕉改入库' },
          { name: '番茄', purcharse: pack(0), statement: pack(1) }
        ]
      }),
      stockStep('结算后库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 3.5 },
        { name: '苹果', cnt: 2 },
        { name: '葡萄', cnt: 4 },
        { name: '番茄', cnt: 0 }
      ]),

      ...this.backFlow(variable)
    ];
  }

  /** 餐厅退货单状态是 instocked，流水类型是 Back。改退货数量应扣减库存。 */
  private backFlow(variable: any): BaseTest[] {
    return [
      new QueryAction({
        name: '读取可退货物料',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${storeNoteId}'
        }
      }, {
        buildVariable(result) {
          return {
            backSrcItems: result.result.content
          };
        }
      }),
      new Action({
        name: '退货香蕉1包',
        url: '/app/noteBack/createNoteBack',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: []
        }
      }, {
        parseHttpParam(param, variable) {
          let row = (variable.backSrcItems as any[]).find(item => item.name == '香蕉');
          param.items = [{
            noteItemId: row.noteItemId,
            stockUnitsId: row.stockUnitsId,
            cnt: 1,
            buyUnitFee: row.buyUnitFee ?? 1,
            price: row.price,
            supplierId: row.supplierId,
            materialId: row.materialId,
            stockBuyUnitFee: row.stockBuyUnitFee ?? 1
          }];
          return param;
        }
      }),
      new QueryAction({
        name: '查询退货单',
        url: '/app/note/listNote',
        query: {
          status: 'instocked',
          type: 'back'
        }
      }, {
        check(result) {
          let row = result.result.content?.[0];
          CheckUtil.expectEqual(row != null, true, '应查到退货单');
          CheckUtil.expectEqual(row.type, 'back', '退货单类型');
          CheckUtil.expectEqual(row.status, 'instocked', '退货单状态');
        },
        buildVariable(result) {
          return {
            backNoteId: result.result.content[0].noteId
          };
        }
      }),
      recalStock('重算退货后库存', 'warehouse'),
      stockStep('退货后库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 2.5 },
        { name: '苹果', cnt: 2 },
        { name: '葡萄', cnt: 4 },
        { name: '番茄', cnt: 0 }
      ]),
      loadItems('读取退货物料', 'backNoteId', 'warehouse'),
      updateItems({
        name: '修改退货数量',
        noteVar: 'backNoteId',
        warehouseKey: 'warehouse',
        updates: [{ name: '香蕉', cnt: pack(2) }],
        adds: [{ name: '苹果', cnt: pack(1), mapKey: 'materialMap' }]
      }),
      ...checkOrder({
        name: '退货修改后',
        noteVar: 'backNoteId',
        warehouseKey: 'warehouse',
        materialCnt: 2,
        moneyCol: 'instockCost',
        money: 2 * 20 + PRICE,
        items: [
          { name: '香蕉', purcharse: pack(1), instock: pack(2), price: { price: 20, buyUnitFee: 1 } },
          { name: '苹果', purcharse: pack(0), instock: pack(1) }
        ]
      }),
      recalStock('重算退货修改后库存', 'warehouse'),
      stockStep('退货修改后库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 1.5 },
        { name: '苹果', cnt: 1 },
        { name: '葡萄', cnt: 4 },
        { name: '番茄', cnt: 0 }
      ])
    ];
  }

  private supplierPrepare(variable: any, today: string, day10: string): BaseTest[] {
    let names = ['白菜', '萝卜', '黄瓜', '土豆'];
    return [
      new AddWarehouse({
        name: '新供应商',
        variableType: 'supplierWarehouse',
        type: 'supplier'
      }),
      new ChangeWarehouse2Supplier(),
      ...names.map(name => new SaveMaterial({
        name,
        buyUnit: [{ name: '包', fee: 1, isSupplier: true }]
      }, {
        warehouseType: 'supplierWarehouse'
      })),
      new QueryAction({
        name: '读取供应商物料',
        url: '/app/material/listMaterialByCategory',
        query: {
          warehouseId: '${supplierWarehouse.warehouseId}'
        }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let map: any = {};
          for (let row of result.result.content ?? []) {
            map[row.name] = { materialId: row.materialId };
          }
          return { supplierMaterialMap: map };
        }
      }),
      savePackSpec('白菜', 'supplierMaterialMap', 'supplierWarehouse'),
      new Action({
        name: '盘点各100包',
        url: '/app/inventory/setInventoryByArray',
        method: 'POST',
        param: {
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}',
          array: []
        }
      }, {
        warehouseType: 'supplierWarehouse',
        parseHttpParam(param, runVariable) {
          param.array = names.map(name => ({
            materialId: runVariable.supplierMaterialMap[name].materialId,
            cnt: 100,
            buyUnitFee: 1,
            cost: 0
          }));
          return param;
        }
      }),
      new Action({
        name: '盘点日期改成10天前',
        remark: '盘点必须早于发货，后面发货才能扣到这次库存',
        url: '/app/inventory/changeInventoryTime',
        method: 'POST',
        param: {
          warehouseId: '${supplierWarehouse.warehouseId}',
          warehouseGroupId: '${supplierWarehouse.warehouseGroupId}',
          inventoryDay: today,
          newInventoryDay: day10
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),
      stockStep('盘点后库存', 'supplierWarehouse', 'supplierMaterialMap', variable, [
        { name: '白菜', cnt: 100 },
        { name: '萝卜', cnt: 100 },
        { name: '黄瓜', cnt: 100 },
        { name: '土豆', cnt: 100 }
      ]),
      new ChangeWarehouse()
    ];
  }

  /** 先用猪肉单把餐厅供应商和供应商仓关联，再发蔬菜单，供应商侧才是待接单。 */
  private linkAndSend(): BaseTest[] {
    return [
      storeMaterial('白菜'),
      storeMaterial('萝卜'),
      storeMaterial('黄瓜'),
      storeMaterial('土豆'),
      new ListMaterial(),
      savePackSpec('白菜', 'materialMap', 'warehouse'),

      createOrder('发送猪肉单用于关联', [
        { name: '猪肉', packs: 1 }
      ], 'linkSeedNoteId'),
      sendOrder('发送关联用订单'),
      new SaveShareData({
        data: { noteId: '${linkSeedNoteId}' }
      }),
      new Action({
        url: '/share/shareNote',
        name: '查询分享单',
        param: {
          shareDataNo: '${shareDataNo}',
          usersId: '${usersId}'
        }
      }),
      new ChangeWarehouse2Supplier(),
      new Action({
        url: '/app/note/linkNote',
        name: '供应商接单建立关联',
        method: 'POST',
        param: {
          warehouseId: '${supplierWarehouse.warehouseId}',
          _shareDataNo: '${shareDataNo}'
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),
      new ChangeWarehouse(),

      createOrder('发送订单：白菜2包萝卜3包', [
        { name: '白菜', packs: 2 },
        { name: '萝卜', packs: 3 }
      ], 'storeVegNoteId'),
      sendOrder('发送蔬菜订单'),
      new QueryAction({
        name: '记下供应商待接单',
        url: '/app/note/listNote',
        query: {
          noteId: '${storeVegNoteId}'
        }
      }, {
        buildVariable(result) {
          let row = result.result.content[0];
          CheckUtil.expectEqual(
            row?.linkNoteId != null && row.linkNoteId !== 0,
            true,
            '发单后应生成供应商订单'
          );
          return {
            supplierNoteId: row.linkNoteId
          };
        }
      }),
      new ChangeWarehouse2Supplier()
    ];
  }

  private supplierFlow(variable: any, day3: string, supplierStock: { name: string, cnt: number }[]): BaseTest[] {
    let full = [
      { name: '白菜', cnt: 100 },
      { name: '萝卜', cnt: 100 },
      { name: '黄瓜', cnt: 100 },
      { name: '土豆', cnt: 100 }
    ];
    return [
      new QueryAction({
        name: '确认待接单',
        url: '/app/note/listNote',
        query: {
          noteId: '${supplierNoteId}'
        }
      }, {
        warehouseType: 'supplierWarehouse',
        check(result) {
          CheckUtil.expectEqual(result.result.content[0].status, 'normal', '供应商订单应为待接单');
        }
      }),
      loadItems('读取待接单物料', 'supplierNoteId', 'supplierWarehouse'),
      updateItems({
        name: '修改待接单订货数量',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        updates: [{ name: '白菜', cnt: pack(3) }],
        dels: ['萝卜'],
        adds: [
          { name: '黄瓜', cnt: pack(4), mapKey: 'supplierMaterialMap' },
          { name: '土豆', cnt: pack(5), mapKey: 'supplierMaterialMap' }
        ]
      }),
      ...checkOrder({
        name: '待接单修改后',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        materialCnt: 3,
        moneyCol: 'cost',
        money: yuan(3 + 4 + 5),
        items: [
          { name: '白菜', purcharse: pack(3) },
          { name: '黄瓜', purcharse: pack(4) },
          { name: '土豆', purcharse: pack(5) }
        ]
      }),
      stockStep('待接单库存不变', 'supplierWarehouse', 'supplierMaterialMap', variable, full),

      processNote('接单', 'supplierNoteId', 'accept', 'supplierWarehouse', 'send'),
      loadItems('读取接单物料', 'supplierNoteId', 'supplierWarehouse'),
      updateItems({
        name: '接单后修改订货数量',
        remark: 'accept 改的是订货数量 cnt，不是拣货数量',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        updates: [
          { name: '白菜', cnt: gram(3, 50) },
          { name: '黄瓜', cnt: pack(4) }
        ],
        dels: ['土豆'],
        adds: [{ name: '萝卜', cnt: pack(2), mapKey: 'supplierMaterialMap' }]
      }),
      ...checkOrder({
        name: '接单修改后',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        materialCnt: 3,
        moneyCol: 'cost',
        money: yuan(3.5 + 4 + 2),
        items: [
          { name: '白菜', purcharse: gram(3, 50), pick: pack(0) },
          { name: '黄瓜', purcharse: pack(4), pick: pack(0) },
          { name: '萝卜', purcharse: pack(2), pick: pack(0) }
        ]
      }),
      stockStep('接单库存不变', 'supplierWarehouse', 'supplierMaterialMap', variable, full),

      processNote('拣货', 'supplierNoteId', 'pick', 'supplierWarehouse', 'send'),
      loadItems('读取拣货物料', 'supplierNoteId', 'supplierWarehouse'),
      updateItems({
        name: '修改拣货数量',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        updates: [
          { name: '白菜', cnt: gram(3, 50) },
          { name: '黄瓜', cnt: pack(4) },
          { name: '萝卜', cnt: pack(1) }
        ]
      }),
      ...checkOrder({
        name: '拣货修改后',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        materialCnt: 3,
        moneyCol: 'pickCost',
        money: yuan(3.5 + 4 + 1),
        items: [
          { name: '白菜', purcharse: gram(3, 50), pick: gram(3, 50) },
          { name: '黄瓜', purcharse: pack(4), pick: pack(4) },
          { name: '萝卜', purcharse: pack(2), pick: pack(1) }
        ]
      }),
      stockStep('拣货库存不变', 'supplierWarehouse', 'supplierMaterialMap', variable, full),

      processNote('发货', 'supplierNoteId', 'send', 'supplierWarehouse', 'send'),
      recalStock('重算刚发货库存', 'supplierWarehouse'),
      stockStep('刚发货库存', 'supplierWarehouse', 'supplierMaterialMap', variable, [
        { name: '白菜', cnt: 96.5 },
        { name: '黄瓜', cnt: 96 },
        { name: '萝卜', cnt: 99 },
        { name: '土豆', cnt: 100 }
      ]),
      new Action({
        name: '发货时间改成3天前',
        remark: '改 note.sendTime。新发货流水的时间取这个发货时间',
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [{ col: 'noteId', val: '${supplierNoteId}' }],
          data: { sendTime: `${day3} 12:00:00` }
        }
      }),
      loadItems('读取发货物料', 'supplierNoteId', 'supplierWarehouse'),
      updateItems({
        name: '修改发货数量',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        updates: [
          { name: '白菜', cnt: gram(3, 50) },
          { name: '黄瓜', cnt: pack(2) }
        ],
        dels: ['萝卜'],
        adds: [{ name: '土豆', cnt: pack(2), mapKey: 'supplierMaterialMap' }]
      }),
      ...checkOrder({
        name: '发货修改后',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        materialCnt: 3,
        moneyCol: 'sendCost',
        money: yuan(3.5 + 2 + 2),
        items: [
          { name: '白菜', purcharse: gram(3, 50), pick: gram(3, 50), send: gram(3, 50) },
          { name: '黄瓜', purcharse: pack(4), pick: pack(4), send: pack(2) },
          { name: '土豆', purcharse: pack(0), pick: pack(0), send: pack(2) }
        ]
      }),
      recalStock('重算发货库存', 'supplierWarehouse'),
      stockStep('发货修改后库存', 'supplierWarehouse', 'supplierMaterialMap', variable, supplierStock),
      this.checkSendRecords(variable, day3),

      processNote('出库', 'supplierNoteId', 'outstock', 'supplierWarehouse', 'send'),
      loadItems('读取出库物料', 'supplierNoteId', 'supplierWarehouse'),
      updateItems({
        name: '修改出库数量',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        updates: [{ name: '白菜', cnt: pack(2) }],
        dels: ['土豆'],
        adds: [{ name: '萝卜', cnt: pack(1), mapKey: 'supplierMaterialMap' }]
      }),
      ...checkOrder({
        name: '出库修改后',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        materialCnt: 3,
        moneyCol: 'outstockCost',
        money: yuan(2 + 2 + 1),
        items: [
          { name: '白菜', send: gram(3, 50), outstock: pack(2) },
          { name: '黄瓜', send: pack(2), outstock: pack(2) },
          { name: '萝卜', purcharse: pack(0), pick: pack(0), send: pack(0), outstock: pack(1) }
        ]
      }),
      stockStep('出库后库存不变', 'supplierWarehouse', 'supplierMaterialMap', variable, supplierStock),

      processNote('结算供应商订单', 'supplierNoteId', 'statement', 'supplierWarehouse'),
      loadItems('读取供应商结算物料', 'supplierNoteId', 'supplierWarehouse'),
      updateItems({
        name: '修改供应商结算数量',
        remark: '土豆已在出库时删除。萝卜出库时已加回，这里改结算数量',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        updates: [
          { name: '白菜', cnt: gram(4, 50) },
          { name: '萝卜', cnt: pack(1) }
        ],
        dels: ['黄瓜']
      }),
      ...checkOrder({
        name: '供应商结算修改后',
        noteVar: 'supplierNoteId',
        warehouseKey: 'supplierWarehouse',
        materialCnt: 2,
        moneyCol: 'statementCost',
        money: yuan(4.5 + 1),
        items: [
          { name: '白菜', statement: gram(4, 50) },
          { name: '萝卜', statement: pack(1) }
        ]
      }),
      stockStep('结算后库存仍为发货后', 'supplierWarehouse', 'supplierMaterialMap', variable, supplierStock)
    ];
  }

  /** 新增土豆的发货流水时间取订单发货时间。isDel=0 时 noteItemType+noteItemId 不重复。 */
  private checkSendRecords(variable: any, sendDay: string): Action {
    return new Action({
      name: '校验发货流水',
      url: '/free/query',
      param: {
        array: [{
          table: 'stock_record',
          query: {
            warehouseId: '${supplierWarehouse.warehouseId}',
            warehouseGroupId: '${supplierWarehouse.warehouseGroupId}',
            isDel: 0
          }
        }]
      }
    }, {
      check(result) {
        let rows: any[] = result.result?.stock_record ?? [];
        let keys = rows.map(row => `${row.noteItemType}_${row.noteItemId}`);
        CheckUtil.expectEqual(
          new Set(keys).size,
          keys.length,
          `isDel=0 时 noteItemType+noteItemId 重复 ${JSON.stringify(keys)}`
        );
        let items: any[] = variable.noteItems ?? [];
        for (let item of items) {
          let matched = rows.filter(row =>
            String(row.noteItemId) === String(item.noteItemId)
            && row.noteItemType === 'noteItem'
            && row.type === 'send'
          );
          CheckUtil.expectEqual(matched.length, 1, `${item.name}应有一条发货流水，实际${matched.length}`);
          if (item.name === '土豆') {
            CheckUtil.expectEqual(dayOf(matched[0].bussinessDate), sendDay, '土豆发货流水时间应取订单发货时间');
          }
        }
      }
    });
  }
}

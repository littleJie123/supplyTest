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

const PRICE = 10;

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

function recalStock(name: string, warehouseKey: WarehouseType): Action {
  return new Action({
    name,
    url: '/free/script/recalStockRecordByWarehouse',
    method: 'POST',
    param: {
      warehouseId: `\${${warehouseKey}.warehouseId}`,
      warehouseGroupId: `\${${warehouseKey}.warehouseGroupId}`
    }
  }, {
    warehouseType: warehouseKey
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
    method: 'POST',
    param: {
      array: [{
        query: {
          warehouseId: `\${${warehouseKey}.warehouseId}`,
          warehouseGroupId: `\${${warehouseKey}.warehouseGroupId}`
        },
        table: 'stock'
      }]
    }
  }, {
    warehouseType: warehouseKey,
    check(result) {
      let rows: any[] = result.result?.stock ?? [];
      for (let line of lines) {
        let materialId = variable[mapKey][line.name].materialId;
        let row = rows.find(item => String(item.materialId) === String(materialId));
        let actual = row == null
          ? { cnt: 0, buyUnitFee: 1 }
          : { cnt: row.cnt ?? 0, buyUnitFee: row.buyUnitFee ?? 1 };
        CheckUtil.expectEqual(
          StockUtil.isEq(actual, { cnt: line.cnt, buyUnitFee: 1 }),
          true,
          `${line.name}库存 实际=${JSON.stringify(actual)} 期望=${line.cnt}`
        );
      }
    }
  });
}

function inventory(
  name: string,
  warehouseKey: WarehouseType,
  mapKey: string,
  day: string,
  lines: { name: string, cnt: number }[]
): Action {
  return new Action({
    name,
    url: '/app/inventory/setInventoryByArray',
    method: 'POST',
    param: {
      warehouseId: `\${${warehouseKey}.warehouseId}`,
      warehouseGroupId: `\${${warehouseKey}.warehouseGroupId}`,
      bussinessDate: day,
      array: []
    }
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(param, variable) {
      param.array = lines.map(line => ({
        materialId: variable[mapKey][line.name].materialId,
        cnt: line.cnt,
        buyUnitFee: 1,
        cost: 0
      }));
      return param;
    }
  });
}

function updateNoteTime(
  name: string,
  noteVar: string,
  warehouseKey: WarehouseType,
  time: string,
  col: 'createTime' | 'lastUpdateTime',
  highlight?: boolean
): Action {
  return new Action({
    name,
    url: '/app/note/updateNoteTime',
    method: 'POST',
    highlight,
    param: {
      noteId: `\${${noteVar}}`,
      [col]: time,
      warehouseId: `\${${warehouseKey}.warehouseId}`,
      warehouseGroupId: `\${${warehouseKey}.warehouseGroupId}`
    }
  }, {
    warehouseType: warehouseKey
  });
}

function checkItemTime(
  name: string,
  noteVar: string,
  warehouseKey: WarehouseType,
  col: string,
  day: string
): QueryAction {
  return new QueryAction({
    name,
    url: '/app/noteItem/listNoteItem',
    query: {
      noteId: `\${${noteVar}}`
    }
  }, {
    warehouseType: warehouseKey,
    check(result) {
      let content: any[] = result.result.content ?? [];
      CheckUtil.expectEqual(content.length > 0, true, '应有订单物料');
      for (let row of content) {
        CheckUtil.expectEqual(
          dayOf(row[col]),
          day,
          `${row.name} ${col} 应为${day}，实际${row[col]}`
        );
      }
    }
  });
}

function checkTime(
  name: string,
  noteVar: string,
  warehouseKey: WarehouseType,
  col: string,
  day: string
): QueryAction {
  return new QueryAction({
    name,
    url: '/app/note/listNote',
    query: {
      noteId: `\${${noteVar}}`
    }
  }, {
    warehouseType: warehouseKey,
    check(result) {
      let row = result.result.content[0];
      CheckUtil.expectEqual(dayOf(row?.[col]), day, `${col} 应为${day}，实际${row?.[col]}`);
    }
  });
}

/**
 * 盘点在 3 天前的日终。入库、发货、退货的状态时间改到盘点之前，当前库存回到盘点数量。
 * 创建时间，以及接单、拣货、出库、结算时间，不改变库存。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '修改订单时间：只有入库、发货、退货的状态时间会改变库存' });
  }

  getName(): string {
    return '修改订单时间';
  }

  protected buildActions(): BaseTest[] {
    let variable = this.getVariable();
    let today = DateUtil.todayStr();
    let day3 = shiftDay(-3);
    let day10 = shiftDay(-10);
    let beforeInventory = `${day10} 12:00:00`;
    return [
      new PreTest({
        materialsOpts: [
          { name: '猪肉', category: '肉类', unit: '斤' }
        ]
      }),
      storeMaterial('香蕉'),
      storeMaterial('苹果'),
      new ListMaterial(),
      inventory('餐厅盘点香蕉苹果各10包', 'warehouse', 'materialMap', day3, [
        { name: '香蕉', cnt: 10 },
        { name: '苹果', cnt: 10 }
      ]),
      recalStock('重算盘点库存', 'warehouse'),
      stockStep('盘点后库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 10 },
        { name: '苹果', cnt: 10 }
      ]),

      createOrder('入库香蕉2包苹果4包', [
        { name: '香蕉', packs: 2 },
        { name: '苹果', packs: 4 }
      ], 'storeNoteId'),
      sendOrder('发送入库订单'),
      processNote('入库', 'storeNoteId', 'instock', 'warehouse', 'purcharse'),
      recalStock('重算入库库存', 'warehouse'),
      stockStep('入库后库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 12 },
        { name: '苹果', cnt: 14 }
      ]),
      updateNoteTime('只改创建时间', 'storeNoteId', 'warehouse', beforeInventory, 'createTime'),
      checkTime('创建时间已改', 'storeNoteId', 'warehouse', 'createTime', day10),
      checkTime('入库时间仍是今天', 'storeNoteId', 'warehouse', 'instockTime', today),
      checkItemTime('明细创建时间已改', 'storeNoteId', 'warehouse', 'createTime', day10),
      checkItemTime('明细入库时间仍是今天', 'storeNoteId', 'warehouse', 'instockTime', today),
      recalStock('重算只改创建时间后的库存', 'warehouse'),
      stockStep('只改创建时间库存不变', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 12 },
        { name: '苹果', cnt: 14 }
      ]),
      updateNoteTime('入库时间改到盘点前', 'storeNoteId', 'warehouse', beforeInventory, 'lastUpdateTime', true),
      checkTime('校验入库时间', 'storeNoteId', 'warehouse', 'instockTime', day10),
      checkItemTime('明细入库时间已改', 'storeNoteId', 'warehouse', 'instockTime', day10),
      checkItemTime('明细创建时间仍是改期日', 'storeNoteId', 'warehouse', 'createTime', day10),
      recalStock('重算入库改期库存', 'warehouse'),
      stockStep('入库改到盘点前的库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 10 },
        { name: '苹果', cnt: 10 }
      ]),

      createOrder('再入库香蕉3包', [
        { name: '香蕉', packs: 3 }
      ], 'storeNoteId2'),
      sendOrder('发送第二张入库订单'),
      processNote('入库第二张', 'storeNoteId2', 'instock', 'warehouse', 'purcharse'),
      recalStock('重算第二张入库库存', 'warehouse'),
      stockStep('第二张入库后库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 13 },
        { name: '苹果', cnt: 10 }
      ]),
      new QueryAction({
        name: '读取第二张入库物料',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${storeNoteId2}'
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
        parseHttpParam(param, runVariable) {
          let row = (runVariable.backSrcItems as any[]).find(item => item.name == '香蕉');
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
        buildVariable(result) {
          let row = result.result.content?.[0];
          CheckUtil.expectEqual(row != null, true, '应查到退货单');
          return {
            backNoteId: row.noteId
          };
        }
      }),
      recalStock('重算退货库存', 'warehouse'),
      stockStep('退货后库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 12 },
        { name: '苹果', cnt: 10 }
      ]),
      updateNoteTime('只改退货单创建时间', 'backNoteId', 'warehouse', beforeInventory, 'createTime'),
      checkTime('退货创建时间已改', 'backNoteId', 'warehouse', 'createTime', day10),
      checkTime('退货入库时间仍是今天', 'backNoteId', 'warehouse', 'instockTime', today),
      checkItemTime('退货明细创建时间已改', 'backNoteId', 'warehouse', 'createTime', day10),
      checkItemTime('退货明细入库时间仍是今天', 'backNoteId', 'warehouse', 'instockTime', today),
      recalStock('重算只改退货创建时间后的库存', 'warehouse'),
      stockStep('只改退货创建时间库存不变', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 12 },
        { name: '苹果', cnt: 10 }
      ]),
      updateNoteTime('退货时间改到盘点前', 'backNoteId', 'warehouse', beforeInventory, 'lastUpdateTime'),
      checkTime('校验退货时间', 'backNoteId', 'warehouse', 'instockTime', day10),
      recalStock('重算退货改期库存', 'warehouse'),
      stockStep('退货改到盘点前的库存', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 13 },
        { name: '苹果', cnt: 10 }
      ]),
      processNote('结算第二张入库单', 'storeNoteId2', 'statement', 'warehouse'),
      updateNoteTime('结算时间改到盘点前', 'storeNoteId2', 'warehouse', beforeInventory, 'lastUpdateTime'),
      checkTime('校验结算时间', 'storeNoteId2', 'warehouse', 'statementTime', day10),
      recalStock('重算结算改期库存', 'warehouse'),
      stockStep('结算改期库存不变', 'warehouse', 'materialMap', variable, [
        { name: '香蕉', cnt: 13 },
        { name: '苹果', cnt: 10 }
      ]),

      ...this.supplierFlow(variable, day3, beforeInventory, day10, today)
    ];
  }

  private supplierFlow(
    variable: any,
    day3: string,
    beforeInventory: string,
    day10: string,
    today: string
  ): BaseTest[] {
    return [
      new AddWarehouse({
        name: '新供应商',
        variableType: 'supplierWarehouse',
        type: 'supplier'
      }),
      new ChangeWarehouse2Supplier(),
      new SaveMaterial({
        name: '白菜',
        buyUnit: [{ name: '包', fee: 1, isSupplier: true }]
      }, {
        warehouseType: 'supplierWarehouse'
      }),
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
      inventory('供应商盘点白菜100包', 'supplierWarehouse', 'supplierMaterialMap', day3, [
        { name: '白菜', cnt: 100 }
      ]),
      recalStock('重算供应商盘点库存', 'supplierWarehouse'),
      stockStep('供应商盘点后库存', 'supplierWarehouse', 'supplierMaterialMap', variable, [
        { name: '白菜', cnt: 100 }
      ]),
      new ChangeWarehouse(),

      storeMaterial('白菜'),
      new ListMaterial(),
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
      createOrder('发送白菜2包', [
        { name: '白菜', packs: 2 }
      ], 'storeVegNoteId'),
      sendOrder('发送白菜订单'),
      new QueryAction({
        name: '记下供应商订单',
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
      new ChangeWarehouse2Supplier(),
      processNote('供应商接单', 'supplierNoteId', 'accept', 'supplierWarehouse', 'send'),
      updateNoteTime('接单时间改到盘点前', 'supplierNoteId', 'supplierWarehouse', beforeInventory, 'lastUpdateTime'),
      checkTime('校验接单时间', 'supplierNoteId', 'supplierWarehouse', 'acceptTime', day10),
      recalStock('重算接单改期库存', 'supplierWarehouse'),
      stockStep('接单改期库存不变', 'supplierWarehouse', 'supplierMaterialMap', variable, [
        { name: '白菜', cnt: 100 }
      ]),
      processNote('供应商拣货', 'supplierNoteId', 'pick', 'supplierWarehouse', 'send'),
      updateNoteTime('拣货时间改到盘点前', 'supplierNoteId', 'supplierWarehouse', beforeInventory, 'lastUpdateTime'),
      checkTime('校验拣货时间', 'supplierNoteId', 'supplierWarehouse', 'pickTime', day10),
      recalStock('重算拣货改期库存', 'supplierWarehouse'),
      stockStep('拣货改期库存不变', 'supplierWarehouse', 'supplierMaterialMap', variable, [
        { name: '白菜', cnt: 100 }
      ]),
      processNote('供应商发货', 'supplierNoteId', 'send', 'supplierWarehouse', 'send'),
      recalStock('重算发货库存', 'supplierWarehouse'),
      stockStep('发货后库存', 'supplierWarehouse', 'supplierMaterialMap', variable, [
        { name: '白菜', cnt: 98 }
      ]),
      updateNoteTime('只改发货单创建时间', 'supplierNoteId', 'supplierWarehouse', beforeInventory, 'createTime'),
      checkTime('发货单创建时间已改', 'supplierNoteId', 'supplierWarehouse', 'createTime', day10),
      checkTime('发货时间仍是今天', 'supplierNoteId', 'supplierWarehouse', 'sendTime', today),
      checkItemTime('发货明细创建时间已改', 'supplierNoteId', 'supplierWarehouse', 'createTime', day10),
      checkItemTime('发货明细发货时间仍是今天', 'supplierNoteId', 'supplierWarehouse', 'sendTime', today),
      checkTime('关联订货单创建时间不变', 'storeVegNoteId', 'warehouse', 'createTime', today),
      checkItemTime('关联订货明细创建时间不变', 'storeVegNoteId', 'warehouse', 'createTime', today),
      recalStock('重算只改发货创建时间后的库存', 'supplierWarehouse'),
      stockStep('只改发货创建时间库存不变', 'supplierWarehouse', 'supplierMaterialMap', variable, [
        { name: '白菜', cnt: 98 }
      ]),
      updateNoteTime('发货时间改到盘点前', 'supplierNoteId', 'supplierWarehouse', beforeInventory, 'lastUpdateTime'),
      checkTime('校验发货时间', 'supplierNoteId', 'supplierWarehouse', 'sendTime', day10),
      checkItemTime('发货明细发货时间已改', 'supplierNoteId', 'supplierWarehouse', 'sendTime', day10),
      checkItemTime('发货明细创建时间仍是改期日', 'supplierNoteId', 'supplierWarehouse', 'createTime', day10),
      checkTime('关联订货单创建时间仍是今天', 'storeVegNoteId', 'warehouse', 'createTime', today),
      recalStock('重算发货改期库存', 'supplierWarehouse'),
      stockStep('发货改到盘点前的库存', 'supplierWarehouse', 'supplierMaterialMap', variable, [
        { name: '白菜', cnt: 100 }
      ]),
      processNote('供应商出库', 'supplierNoteId', 'outstock', 'supplierWarehouse', 'send'),
      updateNoteTime('出库时间改到盘点前', 'supplierNoteId', 'supplierWarehouse', beforeInventory, 'lastUpdateTime'),
      checkTime('校验出库时间', 'supplierNoteId', 'supplierWarehouse', 'outstockTime', day10),
      recalStock('重算出库改期库存', 'supplierWarehouse'),
      stockStep('出库改期库存不变', 'supplierWarehouse', 'supplierMaterialMap', variable, [
        { name: '白菜', cnt: 100 }
      ])
    ];
  }
}

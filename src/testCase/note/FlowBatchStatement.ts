import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import AddSupplier from "../../action/supplier/AddSupplier";
import ListSupplier from "../../action/supplier/ListSupplier";
import AddMaterial from "../../action/material/AddMaterial";
import ListMaterial from "../../action/material/ListMaterial";
import ChangeWarehouse2Supplier from "../../action/user/ChangeWarehouse2Supplier";
import StockUtil from "../../util/StockUtil";
import { WarehouseType } from "../../inf/IOpt";

const CNT = 2;
const PRICE = 10;
const COST = 20;
const DAY = '2026-10-01';

/**
 * 批量结算。
 * 检查、批量结算各高亮两次：一次 noteIds，一次 _schParam（不带分页，_notInIds 反选一张）。
 * 餐厅 3 张待入库反选后只结算 2 张并加库存；供应商待拣货缺中间状态，发货扣库存。
 * 已经入库或出库的再结算，不再写库存。
 * 结算后批量取消：一次 noteIds，一次 _schParam（不带分页，_notInIds 反选一张）。
 * 状态回到未结算，结算数量、时间和操作人清空，前面补上的数量保留。
 */
export default class extends TestCase {
  constructor() {
    super({
      remark: '餐厅、供应商缺中间状态时检查并批量结算；跨页反选一张后批量取消，核对笔数和库存'
    })
  }

  getName(): string {
    return '批量结算'
  }

  protected buildActions(): BaseTest[] {
    let variable = this.getVariable()
    return [
      new PreTest({
        materialsOpts: [{
          name: '猪肉',
          category: '肉类',
          buyUnit: [{ name: '斤', isSupplier: true, fee: 1 }],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: PRICE
          }]
        }]
      }).setRemark('餐厅、供应商、猪肉（斤，单价 10）'),

      inventory('餐厅盘点猪肉10', 'warehouse', 'materialMap', [{ name: '猪肉', cnt: 10 }]),

      ...createAndSend('餐厅待入库1', 'noteA', 'warehouse', 'materialMap', '猪肉', '${supplierMap.供应商1}'),
      ...createAndSend('餐厅待入库2', 'noteB', 'warehouse', 'materialMap', '猪肉', '${supplierMap.供应商1}'),
      ...createAndSend('餐厅待入库3', 'noteC', 'warehouse', 'materialMap', '猪肉', '${supplierMap.供应商1}'),
      ...createAndSend('餐厅已入库', 'noteD', 'warehouse', 'materialMap', '猪肉', '${supplierMap.供应商1}'),
      processByIds('餐厅入库noteD', 'instock', 'noteD', 'warehouse', 'purcharse'),

      checkByIds(
        '检查餐厅订单',
        'warehouse',
        ['noteA', 'noteB', 'noteC', 'noteD'],
        [
          { status: 'normal', cnt: 3, cost: COST * 3 },
          { status: 'instocked', cnt: 1, cost: COST }
        ]
      ).setRemark('正常参数 noteIds。待入库金额取 cost，已入库金额取 instockCost').setHighlight(),

      batchByIds('结算已入库', 'warehouse', ['noteD'])
        .setRemark('已在入库状态，只改结算，不再写库存'),

      recalStock('重算已入库结算后库存', 'warehouse'),
      stockOf('已入库结算后库存12', 'warehouse', variable, 'materialMap', '猪肉', 12)
        .setRemark('盘点10 + 已入库2，结算本身不加库存'),

      batchBySch('跨页结算待入库', 'warehouse', 'normal', 'noteC')
        .setRemark('3张待入库。_schParam 不带分页，反选 noteC').setHighlight(),

      queryNotes('餐厅订单状态', 'warehouse', ['noteA', 'noteB', 'noteC', 'noteD'], (rows) => {
        CheckUtil.expectEqual(rows.length, 4, '餐厅订单数')
        let excluded = rows.find(row => String(row.noteId) === String(variable.noteC))
        CheckUtil.expectNotNull(excluded, '反选的订单')
        CheckUtil.expectEqual(excluded.status, 'normal', '反选的订单仍是待入库')
        let settled = rows.filter(row => String(row.noteId) !== String(variable.noteC))
        CheckUtil.expectEqual(settled.length, 3, '结算的餐厅订单')
        for (let row of settled) {
          CheckUtil.expectEqual(row.status, 'statement', '餐厅状态')
          CheckUtil.expectEqual(Number(row.statementCost), COST, '餐厅结算金额')
          CheckUtil.expectEqual(Number(row.instockCost), COST, '餐厅入库金额')
          CheckUtil.expectNotNull(row.statementTime, '餐厅结算时间')
          CheckUtil.expectNotNull(row.instockTime, '餐厅入库时间')
        }
      }),

      queryItems('餐厅明细数量', ['noteA', 'noteB', 'noteC', 'noteD'], (rows) => {
        CheckUtil.expectEqual(rows.length, 4, '餐厅明细数')
        let excluded = rows.find(row => String(row.noteId) === String(variable.noteC))
        CheckUtil.expectNotNull(excluded, '反选明细')
        CheckUtil.expectEqual(excluded.instockCnt == null, true, '反选的明细没有入库数量')
        CheckUtil.expectEqual(excluded.statementCnt == null, true, '反选的明细没有结算数量')
        CheckUtil.expectEqual(excluded.statementTime == null, true, '反选的明细没有结算时间')
        CheckUtil.expectEqual(excluded.statementUser == null, true, '反选的明细没有结算人')
        let settled = rows.filter(row => String(row.noteId) !== String(variable.noteC))
        for (let row of settled) {
          expectCnt(row.instockCnt, row.buyUnitFee, CNT, '餐厅入库数量')
          expectCnt(row.statementCnt, row.buyUnitFee, CNT, '餐厅结算数量')
          CheckUtil.expectNotNull(row.instockTime, '明细入库时间')
          CheckUtil.expectNotNull(row.statementTime, '明细结算时间')
          CheckUtil.expectEqual(Number(row.statementUser), Number(variable.usersId), '明细结算人')
          CheckUtil.expectEqual(
            StockUtil.isEqPrice(
              { price: row.price, buyUnitFee: row.stockBuyUnitFee },
              { price: PRICE, buyUnitFee: 1 }
            ),
            true,
            '餐厅单价'
          )
        }
        variable.storeItemIds = settled.map(row => row.noteItemId)
        variable.storeExcludedItem = excluded.noteItemId
      }),

      recalStock('重算餐厅库存', 'warehouse'),
      stockOf('餐厅库存16', 'warehouse', variable, 'materialMap', '猪肉', 16)
        .setRemark('盘点10 + 已入库2 + 两张补入库各2，反选的不加'),
      stockRecords('餐厅入库流水', 'warehouse', 'materialMap', '猪肉', (rows) => {
        let ids: any[] = variable.storeItemIds
        CheckUtil.expectEqual(ids.length, 3, '已结算明细')
        for (let id of ids) {
          let matched = rows.filter(row => String(row.noteItemId) === String(id) && row.type == 'Instock')
          CheckUtil.expectEqual(matched.length, 1, '每条已结算明细一条入库流水')
          expectCnt(matched[0].cnt, matched[0].buyUnitFee, CNT, '入库流水数量')
        }
        let excluded = rows.filter(row => String(row.noteItemId) === String(variable.storeExcludedItem) && row.type == 'Instock')
        CheckUtil.expectEqual(excluded.length, 0, '反选的订单没有入库流水')
      }),

      batchCancelBySch('跨页取消餐厅结算', 'warehouse', 'statement', 'noteD')
        .setRemark('已结算 3 张。_schParam 状态 statement，不带分页，反选 noteD').setHighlight(),

      batchCancelByIds('取消餐厅已入库', 'warehouse', ['noteD'])
        .setRemark('正常参数 noteIds，取消反选留下的已入库单').setHighlight(),

      queryNotes('取消结算后餐厅订单', 'warehouse', ['noteA', 'noteB', 'noteC', 'noteD'], (rows) => {
        let excluded = rows.find(row => String(row.noteId) === String(variable.noteC))
        CheckUtil.expectNotNull(excluded, '反选的订单')
        CheckUtil.expectEqual(excluded.status, 'normal', '反选的订单仍是待入库')
        let cancelled = rows.filter(row => String(row.noteId) !== String(variable.noteC))
        CheckUtil.expectEqual(cancelled.length, 3, '取消结算的餐厅订单')
        for (let row of cancelled) {
          CheckUtil.expectEqual(row.status, 'instocked', '取消后餐厅状态')
          CheckUtil.expectEqual(Number(row.statementCost), 0, '取消后餐厅结算金额')
          CheckUtil.expectEqual(row.statementTime == null, true, '取消后餐厅结算时间')
          CheckUtil.expectNotNull(row.instockTime, '取消后餐厅入库时间仍在')
        }
      }),

      queryItems('取消结算后餐厅明细', ['noteA', 'noteB', 'noteC', 'noteD'], (rows) => {
        let excluded = rows.find(row => String(row.noteId) === String(variable.noteC))
        CheckUtil.expectNotNull(excluded, '反选明细')
        CheckUtil.expectEqual(excluded.statementCnt == null, true, '反选的明细没有结算数量')
        let cancelled = rows.filter(row => String(row.noteId) !== String(variable.noteC))
        for (let row of cancelled) {
          expectCnt(row.instockCnt, row.buyUnitFee, CNT, '取消后餐厅入库数量')
          CheckUtil.expectNotNull(row.instockTime, '取消后明细入库时间仍在')
          CheckUtil.expectEqual(row.statementCnt == null, true, '取消后明细结算数量')
          CheckUtil.expectEqual(row.statementTime == null, true, '取消后明细结算时间')
          CheckUtil.expectEqual(row.statementUser == null, true, '取消后明细结算人')
        }
      }),

      new AddWarehouse({
        name: '结算供应商',
        variableType: 'supplierWarehouse',
        type: 'supplier'
      }),
      new ChangeWarehouse2Supplier(),
      new AddSupplier('客户', { warehouseType: 'supplierWarehouse' }),
      new ListSupplier({ warehouseType: 'supplierWarehouse' }),
      new AddMaterial('猪肉', {
        type: 'supplierWarehouse',
        buyUnit: [{ name: '斤', isSupplier: true, fee: 1 }],
        suppliers: [{
          isDef: true,
          supplierId: '${supplierMap.客户}',
          price: PRICE
        }]
      }),
      new ListMaterial({ type: 'supplierWarehouse' })
        .setRemark('供应商物料写入 materialMap，后面的库存按这个物料查'),

      inventory('供应商盘点猪肉10', 'supplierWarehouse', 'materialMap', [{ name: '猪肉', cnt: 10 }]),

      ...createAndSend('供应商待出库', 'noteOut', 'supplierWarehouse', 'materialMap', '猪肉', '${supplierMap.客户}'),
      processByIds('供应商拣货', 'pick', 'noteOut', 'supplierWarehouse', 'send'),
      processByIds('供应商发货', 'send', 'noteOut', 'supplierWarehouse', 'send'),
      processByIds('供应商出库', 'outstock', 'noteOut', 'supplierWarehouse', 'send'),

      ...createAndSend('供应商待拣货1', 'noteE', 'supplierWarehouse', 'materialMap', '猪肉', '${supplierMap.客户}'),
      ...createAndSend('供应商待拣货2', 'noteF', 'supplierWarehouse', 'materialMap', '猪肉', '${supplierMap.客户}'),
      ...createAndSend('供应商待拣货3', 'noteG', 'supplierWarehouse', 'materialMap', '猪肉', '${supplierMap.客户}'),

      recalStock('重算供应商发货后库存', 'supplierWarehouse'),
      stockOf('发货后库存8', 'supplierWarehouse', variable, 'materialMap', '猪肉', 8)
        .setRemark('盘点10，出库那张发货已扣2；三张待拣货还没扣'),

      checkByIds(
        '检查供应商订单',
        'supplierWarehouse',
        ['noteE', 'noteF', 'noteG', 'noteOut'],
        [
          { status: 'accept', cnt: 3, cost: COST * 3 },
          { status: 'outstocked', cnt: 1, cost: COST }
        ]
      ).setRemark('待拣货金额取 cost，已出库金额取 outstockCost'),

      checkBySch('跨页检查待拣货', 'supplierWarehouse', 'accept', 'noteG', [
        { status: 'accept', cnt: 2, cost: COST * 2 }
      ]).setRemark('_schParam 状态 accept，不带分页，反选 noteG').setHighlight(),

      batchByIds('结算已出库', 'supplierWarehouse', ['noteOut'])
        .setRemark('已出库只改结算，不再扣库存'),

      recalStock('重算已出库结算后库存', 'supplierWarehouse'),
      stockOf('已出库结算后库存仍为8', 'supplierWarehouse', variable, 'materialMap', '猪肉', 8),

      batchByIds('结算两张待拣货', 'supplierWarehouse', ['noteE', 'noteF'])
        .setRemark('正常参数 noteIds。缺拣货、发货、出库，补齐后发货扣库存').setHighlight(),

      queryNotes('供应商订单状态', 'supplierWarehouse', ['noteE', 'noteF', 'noteG', 'noteOut'], (rows) => {
        CheckUtil.expectEqual(rows.length, 4, '供应商订单数')
        let excluded = rows.find(row => String(row.noteId) === String(variable.noteG))
        CheckUtil.expectNotNull(excluded, '反选的供应商订单')
        CheckUtil.expectEqual(excluded.status, 'accept', '反选的订单仍是待拣货')
        for (let key of ['noteE', 'noteF']) {
          let row = rows.find(item => String(item.noteId) === String(variable[key]))
          CheckUtil.expectNotNull(row, key)
          CheckUtil.expectEqual(row.status, 'statement', '供应商状态')
          CheckUtil.expectEqual(Number(row.pickCost), COST, '拣货金额')
          CheckUtil.expectEqual(Number(row.sendCost), COST, '发货金额')
          CheckUtil.expectEqual(Number(row.outstockCost), COST, '出库金额')
          CheckUtil.expectEqual(Number(row.statementCost), COST, '结算金额')
          CheckUtil.expectNotNull(row.pickTime, '拣货时间')
          CheckUtil.expectNotNull(row.sendTime, '发货时间')
          CheckUtil.expectNotNull(row.outstockTime, '出库时间')
          CheckUtil.expectNotNull(row.statementTime, '结算时间')
        }
      }),

      queryItems('供应商明细数量', ['noteE', 'noteF', 'noteG', 'noteOut'], (rows) => {
        let excluded = rows.find(row => String(row.noteId) === String(variable.noteG))
        let done = rows.find(row => String(row.noteId) === String(variable.noteOut))
        CheckUtil.expectNotNull(excluded, '反选明细')
        CheckUtil.expectNotNull(done, '已出库明细')
        CheckUtil.expectEqual(excluded.pickCnt == null, true, '反选的明细没有拣货数量')
        CheckUtil.expectEqual(excluded.statementTime == null, true, '反选的明细没有结算时间')
        CheckUtil.expectEqual(excluded.statementUser == null, true, '反选的明细没有结算人')
        expectCnt(done.statementCnt, done.buyUnitFee, CNT, '已出库单结算数量')
        CheckUtil.expectNotNull(done.statementTime, '已出库单结算时间')
        CheckUtil.expectEqual(Number(done.statementUser), Number(variable.usersId), '已出库单结算人')
        variable.supplierItemIds = []
        variable.supplierOutItem = done.noteItemId
        variable.supplierExcludedItem = excluded.noteItemId
        for (let key of ['noteE', 'noteF']) {
          let row = rows.find(item => String(item.noteId) === String(variable[key]))
          CheckUtil.expectNotNull(row, key)
          expectCnt(row.pickCnt, row.buyUnitFee, CNT, '拣货数量')
          expectCnt(row.sendCnt, row.buyUnitFee, CNT, '发货数量')
          expectCnt(row.outstockCnt, row.buyUnitFee, CNT, '出库数量')
          expectCnt(row.statementCnt, row.buyUnitFee, CNT, '结算数量')
          CheckUtil.expectNotNull(row.pickTime, '明细拣货时间')
          CheckUtil.expectNotNull(row.sendTime, '明细发货时间')
          CheckUtil.expectNotNull(row.outStockTime, '明细出库时间')
          CheckUtil.expectNotNull(row.statementTime, '明细结算时间')
          CheckUtil.expectEqual(Number(row.statementUser), Number(variable.usersId), '明细结算人')
          variable.supplierItemIds.push(row.noteItemId)
        }
      }),

      recalStock('重算供应商结算后库存', 'supplierWarehouse'),
      stockOf('供应商库存4', 'supplierWarehouse', variable, 'materialMap', '猪肉', 4)
        .setRemark('已出库扣过2，两张待拣货结算再各扣2，反选的不扣'),
      stockRecords('供应商发货流水', 'supplierWarehouse', 'materialMap', '猪肉', (rows) => {
        for (let id of [...variable.supplierItemIds, variable.supplierOutItem]) {
          let matched = rows.filter(row => String(row.noteItemId) === String(id) && row.type == 'send')
          CheckUtil.expectEqual(matched.length, 1, '每条已处理明细一条发货流水')
          expectCnt(matched[0].cnt, matched[0].buyUnitFee, -CNT, '发货流水数量')
        }
        let excluded = rows.filter(row => String(row.noteItemId) === String(variable.supplierExcludedItem) && row.type == 'send')
        CheckUtil.expectEqual(excluded.length, 0, '反选的订单没有发货流水')
      }),

      batchCancelBySch('跨页取消供应商结算', 'supplierWarehouse', 'statement', 'noteOut')
        .setRemark('已结算 3 张。_schParam 状态 statement，不带分页，反选 noteOut').setHighlight(),

      batchCancelByIds('取消供应商已出库', 'supplierWarehouse', ['noteOut'])
        .setRemark('正常参数 noteIds，取消反选留下的已出库单').setHighlight(),

      queryNotes('取消结算后供应商订单', 'supplierWarehouse', ['noteE', 'noteF', 'noteG', 'noteOut'], (rows) => {
        let excluded = rows.find(row => String(row.noteId) === String(variable.noteG))
        CheckUtil.expectNotNull(excluded, '反选的供应商订单')
        CheckUtil.expectEqual(excluded.status, 'accept', '反选的订单仍是待拣货')
        for (let key of ['noteE', 'noteF', 'noteOut']) {
          let row = rows.find(item => String(item.noteId) === String(variable[key]))
          CheckUtil.expectNotNull(row, key)
          CheckUtil.expectEqual(row.status, 'outstocked', '取消后供应商状态')
          CheckUtil.expectEqual(Number(row.statementCost), 0, '取消后供应商结算金额')
          CheckUtil.expectEqual(row.statementTime == null, true, '取消后供应商结算时间')
          CheckUtil.expectNotNull(row.outstockTime, '取消后出库时间仍在')
        }
      }),

      queryItems('取消结算后供应商明细', ['noteE', 'noteF', 'noteG', 'noteOut'], (rows) => {
        let excluded = rows.find(row => String(row.noteId) === String(variable.noteG))
        let done = rows.find(row => String(row.noteId) === String(variable.noteOut))
        CheckUtil.expectNotNull(excluded, '反选明细')
        CheckUtil.expectNotNull(done, '已出库明细')
        CheckUtil.expectEqual(excluded.statementCnt == null, true, '反选的明细没有结算数量')
        CheckUtil.expectEqual(done.statementCnt == null, true, '取消后已出库单结算数量')
        CheckUtil.expectEqual(done.statementTime == null, true, '取消后已出库单结算时间')
        CheckUtil.expectEqual(done.statementUser == null, true, '取消后已出库单结算人')
        expectCnt(done.outstockCnt, done.buyUnitFee, CNT, '取消后已出库数量仍在')
        for (let key of ['noteE', 'noteF']) {
          let row = rows.find(item => String(item.noteId) === String(variable[key]))
          CheckUtil.expectNotNull(row, key)
          expectCnt(row.pickCnt, row.buyUnitFee, CNT, '取消后拣货数量')
          expectCnt(row.sendCnt, row.buyUnitFee, CNT, '取消后发货数量')
          expectCnt(row.outstockCnt, row.buyUnitFee, CNT, '取消后出库数量')
          CheckUtil.expectNotNull(row.pickTime, '取消后明细拣货时间仍在')
          CheckUtil.expectNotNull(row.outStockTime, '取消后明细出库时间仍在')
          CheckUtil.expectEqual(row.statementCnt == null, true, '取消后明细结算数量')
          CheckUtil.expectEqual(row.statementTime == null, true, '取消后明细结算时间')
          CheckUtil.expectEqual(row.statementUser == null, true, '取消后明细结算人')
        }
      })
    ]
  }
}

function expectCnt(cnt: any, buyUnitFee: any, expected: number, msg: string) {
  CheckUtil.expectEqual(
    StockUtil.isEq(
      { cnt: cnt ?? 0, buyUnitFee: buyUnitFee ?? 1 },
      { cnt: expected, buyUnitFee: 1 }
    ),
    true,
    `${msg} 实际=${cnt}/${buyUnitFee} 期望=${expected}`
  )
}

function warehouseParam(key: WarehouseType) {
  return {
    warehouseId: `\${${key}.warehouseId}`,
    warehouseGroupId: `\${${key}.warehouseGroupId}`
  }
}

function createAndSend(
  name: string,
  noteVar: string,
  warehouseKey: WarehouseType,
  mapKey: string,
  materialName: string,
  supplierId: string
): Action[] {
  return [
    new Action({
      name: `下单${name}`,
      url: '/app/note/createNote',
      method: 'POST',
      param: {
        items: [{
          materialId: `\${${mapKey}.${materialName}.materialId}`,
          supplierId,
          cnt: CNT,
          buyUnitFee: 1,
          stockUnitsId: 0,
          price: PRICE,
          stockBuyUnitFee: 1,
          yieldRate: 0
        }],
        ...warehouseParam(warehouseKey)
      }
    }, {
      warehouseType: warehouseKey,
      buildVariable(result) {
        return {
          [noteVar]: result.result[0].noteId
        }
      }
    }),
    new Action({
      name: `发送${name}`,
      url: '/app/note/sendNote',
      method: 'POST',
      param: {
        noteIds: [],
        ...warehouseParam(warehouseKey)
      }
    }, {
      warehouseType: warehouseKey,
      parseHttpParam(param, variable) {
        param.noteIds = [variable[noteVar]]
        return param
      }
    })
  ]
}

function processByIds(
  name: string,
  action: string,
  noteVar: string,
  warehouseKey: WarehouseType,
  type: string
): Action {
  return new Action({
    name,
    url: '/app/note/batchProcessNote',
    method: 'POST',
    param: {
      action,
      type,
      noteIds: [],
      ...warehouseParam(warehouseKey)
    }
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(param, variable) {
      param.noteIds = [variable[noteVar]]
      return param
    }
  })
}

function expectChecks(array: any[], lines: { status: string, cnt: number, cost: number }[]) {
  CheckUtil.expectEqual(array.length, lines.length, '状态行数')
  for (let line of lines) {
    let row = array.find(item => item.status == line.status)
    CheckUtil.expectNotNull(row, line.status)
    CheckUtil.expectEqual(Number(row.cnt), line.cnt, line.status + '笔数')
    CheckUtil.expectEqual(Number(row.cost), line.cost, line.status + '金额')
  }
}

function checkByIds(
  name: string,
  warehouseKey: WarehouseType,
  noteVars: string[],
  lines: { status: string, cnt: number, cost: number }[]
): Action {
  return new Action({
    name,
    url: '/app/note/checkNote4Statement',
    method: 'POST',
    param: {
      noteIds: [],
      ...warehouseParam(warehouseKey)
    }
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(param, variable) {
      param.noteIds = noteVars.map(key => variable[key])
      return param
    },
    check(result) {
      expectChecks(result.result?.array ?? [], lines)
    }
  })
}

function checkBySch(
  name: string,
  warehouseKey: WarehouseType,
  status: string,
  notInVar: string,
  lines: { status: string, cnt: number, cost: number }[]
): Action {
  return new Action({
    name,
    url: '/app/note/checkNote4Statement',
    method: 'POST',
    param: {
      _schParam: {
        status,
        _notInIds: [],
        ...warehouseParam(warehouseKey)
      },
      ...warehouseParam(warehouseKey)
    }
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(param, variable) {
      param._schParam._notInIds = [variable[notInVar]]
      return param
    },
    check(result) {
      expectChecks(result.result?.array ?? [], lines)
    }
  })
}

function batchByIds(name: string, warehouseKey: WarehouseType, noteVars: string[]): Action {
  return new Action({
    name,
    url: '/app/note/batchStatement',
    method: 'POST',
    param: {
      noteIds: [],
      ...warehouseParam(warehouseKey)
    }
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(param, variable) {
      param.noteIds = noteVars.map(key => variable[key])
      return param
    }
  })
}

function batchCancelByIds(name: string, warehouseKey: WarehouseType, noteVars: string[]): Action {
  return new Action({
    name,
    url: '/app/note/batchCancelStatmentNote',
    method: 'POST',
    param: {
      noteIds: [],
      ...warehouseParam(warehouseKey)
    }
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(param, variable) {
      param.noteIds = noteVars.map(key => variable[key])
      return param
    }
  })
}

function batchCancelBySch(
  name: string,
  warehouseKey: WarehouseType,
  status: string,
  notInVar: string
): Action {
  return new Action({
    name,
    url: '/app/note/batchCancelStatmentNote',
    method: 'POST',
    param: {
      _schParam: {
        status,
        _notInIds: [],
        ...warehouseParam(warehouseKey)
      },
      ...warehouseParam(warehouseKey)
    }
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(param, variable) {
      param._schParam._notInIds = [variable[notInVar]]
      return param
    }
  })
}

function batchBySch(
  name: string,
  warehouseKey: WarehouseType,
  status: string,
  notInVar: string
): Action {
  return new Action({
    name,
    url: '/app/note/batchStatement',
    method: 'POST',
    param: {
      _schParam: {
        status,
        _notInIds: [],
        ...warehouseParam(warehouseKey)
      },
      ...warehouseParam(warehouseKey)
    }
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(param, variable) {
      param._schParam._notInIds = [variable[notInVar]]
      return param
    }
  })
}

function queryNotes(
  name: string,
  warehouseKey: WarehouseType,
  noteVars: string[],
  assert: (rows: any[]) => void
): Action {
  return new Action({
    name,
    url: '/free/query',
    method: 'POST',
    param: {
      array: [{
        table: 'note',
        query: {
          noteId: [],
          isDel: 0,
          ...warehouseParam(warehouseKey)
        }
      }]
    }
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(param, variable) {
      param.array[0].query.noteId = noteVars.map(key => variable[key])
      return param
    },
    check(result) {
      assert(result.result?.note ?? [])
    }
  })
}

function queryItems(
  name: string,
  noteVars: string[],
  assert: (rows: any[]) => void
): Action {
  return new Action({
    name,
    url: '/free/query',
    method: 'POST',
    param: {
      array: [{
        table: 'noteItem',
        query: {
          noteId: [],
          isDel: 0
        }
      }]
    }
  }, {
    parseHttpParam(param, variable) {
      param.array[0].query.noteId = noteVars.map(key => variable[key])
      return param
    },
    check(result) {
      assert(result.result?.noteItem ?? [])
    }
  })
}

function recalStock(name: string, warehouseKey: WarehouseType): Action {
  return new Action({
    name,
    url: '/free/script/recalStockRecordByWarehouse',
    method: 'POST',
    param: warehouseParam(warehouseKey)
  }, {
    warehouseType: warehouseKey
  })
}

function inventory(
  name: string,
  warehouseKey: WarehouseType,
  mapKey: string,
  lines: { name: string, cnt: number }[]
): Action {
  return new Action({
    name,
    url: '/app/inventory/setInventoryByArray',
    method: 'POST',
    param: {
      ...warehouseParam(warehouseKey),
      bussinessDate: DAY,
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
      }))
      return param
    }
  })
}

function stockOf(
  name: string,
  warehouseKey: WarehouseType,
  variable: any,
  mapKey: string,
  materialName: string,
  cnt: number
): Action {
  return new Action({
    name,
    url: '/free/query',
    method: 'POST',
    param: {
      array: [{
        query: warehouseParam(warehouseKey),
        table: 'stock'
      }]
    }
  }, {
    warehouseType: warehouseKey,
    check(result) {
      let materialId = variable[mapKey][materialName].materialId
      let rows: any[] = result.result?.stock ?? []
      let row = rows.find(item => String(item.materialId) === String(materialId))
      let actual = row == null
        ? { cnt: 0, buyUnitFee: 1 }
        : { cnt: row.cnt ?? 0, buyUnitFee: row.buyUnitFee ?? 1 }
      CheckUtil.expectEqual(
        StockUtil.isEq(actual, { cnt, buyUnitFee: 1 }),
        true,
        `${materialName}库存 实际=${JSON.stringify(actual)} 期望=${cnt}`
      )
    }
  })
}

function stockRecords(
  name: string,
  warehouseKey: WarehouseType,
  mapKey: string,
  materialName: string,
  assert: (rows: any[]) => void
): Action {
  return new Action({
    name,
    url: '/free/query',
    method: 'POST',
    param: {
      array: [{
        table: 'stockRecord',
        query: {
          materialId: 0,
          isDel: 0,
          ...warehouseParam(warehouseKey)
        }
      }]
    }
  }, {
    warehouseType: warehouseKey,
    parseHttpParam(param, variable) {
      param.array[0].query.materialId = variable[mapKey][materialName].materialId
      return param
    },
    check(result) {
      assert(result.result?.stockRecord ?? [])
    }
  })
}

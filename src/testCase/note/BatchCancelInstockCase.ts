import { BaseTest, CheckUtil, TestCase } from "testflow";
import Action from "../../action/Action";
import AddMaterial from "../../action/material/AddMaterial";
import ListMaterial from "../../action/material/ListMaterial";
import QueryAction from "../../action/QueryAction";
import StockUtil from "../../util/StockUtil";

const MATERIAL = '取消入库料';
const PRICE = 10;

/**
 * 批量取消入库。
 * 门店1：手工入库留下，退过货的采购单和另一张合格采购单取消；已对账、类型被改、仓库组不一致、未入库的跳过。
 * 门店2：手工入库留下，采购单取消。同一请求里两个仓库各自按最小业务时间重算。
 * 关联单、yieldRate、cnt、price、buyUnitFee、backCnt 保持取消前的值。
 * 再造 3 张已入库单做跨页全选：_schParam 带 pageSize=1，反选 1 张，其余可取消的取消。
 */
export default class BatchCancelInstockCase extends TestCase {
  constructor() {
    super({
      remark: '批量取消入库：正常取消、跳过不合适的单，并按列表条件跨页全选、反选一张'
    })
  }

  getName(): string {
    return '批量取消入库'
  }

  protected buildActions(): BaseTest[] {
    let variable = this.getVariable();
    let wh1 = '${warehouse.warehouseId}';
    let wh2 = '${ciWh2.warehouseId}';
    return [
      new AddMaterial(MATERIAL, {
        buyUnit: [{ name: '斤', fee: 1, isSupplier: true }],
        categoryId: '${categoryMap.肉类}',
        suppliers: [{
          isDef: true,
          supplierId: '${supplierMap.供应商1}',
          price: PRICE
        }]
      }).setRemark('单独物料，不影响前面用例的库存'),
      new ListMaterial().setRemark('刷新 materialMap'),

      new Action({
        name: '放开第二家门店额度',
        url: '/free/update',
        method: 'POST',
        param: {
          table: 'warehouseGroup',
          cdts: [{ col: 'warehouseGroupId', val: '${warehouse.warehouseGroupId}' }],
          data: { cnt: 2 }
        }
      }),
      new Action({
        name: '增加第二家门店',
        url: '/app/warehouse/addWarehouseToGroup',
        method: 'POST',
        param: {
          warehouse: {
            name: '取消入库门店2',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            type: 'store'
          }
        }
      }, {
        buildVariable(result) {
          return { ciWh2: result.result }
        }
      }),

      ...handInstock('门店1手工入库3斤', wh1, 3, 30, 'ciHand'),
      ...instockNote('门店1采购A', 'ciNoteA', wh1, 2),
      ...backFrom('ciNoteA', 'ciBack'),
      ...instockNote('门店1采购F', 'ciNoteF', wh1, 4),
      ...instockNote('门店1已对账C', 'ciNoteC', wh1, 1),
      ...instockNote('门店1改类型D', 'ciNoteD', wh1, 1),
      ...instockNote('门店1改仓库组E', 'ciNoteE', wh1, 1),
      ...sendOnly('门店1未入库G', 'ciNoteG', wh1),
      ...handInstock('门店2手工入库1斤', wh2, 1, 10, 'ciHand2'),
      ...instockNote('门店2采购B', 'ciNoteB', wh2, 5),
      ...sendOnly('关联单', 'ciLink', wh1),

      updateRow('A标成已对账的单改为billId', 'note', 'noteId', 'ciNoteC', { billId: 1 }),
      updateRow('D改成非采购类型', 'note', 'noteId', 'ciNoteD', { type: 'send' }),
      updateRow('E改到其他仓库组', 'note', 'noteId', 'ciNoteE', { warehouseGroupId: 99999999 }),
      updateRow('A挂上关联单', 'note', 'noteId', 'ciNoteA', { linkNoteId: '${ciLink}' }),

      new Action({
        name: '记下明细并写入不该被清掉的字段',
        url: '/free/query',
        method: 'POST',
        param: {
          array: [
            itemQuery('ciItemA', '${ciNoteA}'),
            itemQuery('ciItemF', '${ciNoteF}')
          ]
        }
      }, {
        buildVariable(result) {
          let itemA = (result.result?.ciItemA ?? [])[0]
          let itemF = (result.result?.ciItemF ?? [])[0]
          variable.ciItemAId = itemA?.noteItemId
          variable.ciItemFId = itemF?.noteItemId
          return {}
        }
      }),
      updateRow('A明细写入yieldRate', 'noteItem', 'noteItemId', 'ciItemAId', {
        yieldRate: 2
      }),
      updateRow('F明细写入yieldRate', 'noteItem', 'noteItemId', 'ciItemFId', {
        yieldRate: 4,
        backCnt: 0
      }),

      new Action({
        name: '记下取消前的关联单',
        url: '/free/query',
        method: 'POST',
        param: {
          array: [
            noteQuery('ciLinkBefore', '${ciLink}'),
            itemQuery('ciLinkItemBefore', '${ciLink}'),
            itemQuery('ciAItemBefore', '${ciNoteA}'),
            itemQuery('ciFItemBefore', '${ciNoteF}')
          ]
        }
      }, {
        buildVariable(result) {
          return {
            ciLinkBefore: (result.result?.ciLinkBefore ?? [])[0],
            ciLinkItemBefore: (result.result?.ciLinkItemBefore ?? [])[0],
            ciAItemBefore: (result.result?.ciAItemBefore ?? [])[0],
            ciFItemBefore: (result.result?.ciFItemBefore ?? [])[0]
          }
        }
      }),

      new Action({
        name: '批量取消入库',
        remark: '同一批：A/F/B应取消；手工单、退货单、已对账、改类型、改仓库组、未入库应跳过',
        url: '/app/note/batchCancelInstock',
        method: 'POST',
        param: {
          noteIds: [],
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        parseHttpParam(param, variable) {
          param.noteIds = [
            variable.ciNoteA,
            variable.ciNoteF,
            variable.ciNoteB,
            variable.ciNoteC,
            variable.ciNoteD,
            variable.ciNoteE,
            variable.ciNoteG,
            variable.ciHand,
            variable.ciHand2,
            variable.ciBack
          ]
          return param
        }
      }).setHighlight(),

      new Action({
        name: '执行库存重算',
        remark: '取消入库把重算登记到定时任务，这里按仓库组跑掉',
        url: '/free/script/runTimer',
        method: 'POST',
        param: {
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),

      new Action({
        name: '校验取消入库结果',
        remark: '状态和字段、关联单不变、流水删除、两家门店库存',
        url: '/free/query',
        method: 'POST',
        param: {
          array: [
            noteQuery('noteA', '${ciNoteA}'),
            noteQuery('noteF', '${ciNoteF}'),
            noteQuery('noteB', '${ciNoteB}'),
            noteQuery('noteC', '${ciNoteC}'),
            noteQuery('noteD', '${ciNoteD}'),
            noteQuery('noteE', '${ciNoteE}'),
            noteQuery('noteG', '${ciNoteG}'),
            noteQuery('noteHand', '${ciHand}'),
            noteQuery('noteHand2', '${ciHand2}'),
            noteQuery('noteBack', '${ciBack}'),
            noteQuery('noteLink', '${ciLink}'),
            itemQuery('itemA', '${ciNoteA}'),
            itemQuery('itemF', '${ciNoteF}'),
            itemQuery('itemB', '${ciNoteB}'),
            itemQuery('itemLink', '${ciLink}'),
            itemQuery('itemBack', '${ciBack}'),
            {
              table: 'stockRecord',
              key: 'records',
              query: {
                materialId: '${materialMap.取消入库料.materialId}',
                noteItemType: 'noteItem'
              }
            },
            {
              table: 'stock',
              key: 'stock1',
              query: {
                materialId: '${materialMap.取消入库料.materialId}',
                warehouseId: '${warehouse.warehouseId}',
                isDel: 0
              }
            },
            {
              table: 'stock',
              key: 'stock2',
              query: {
                materialId: '${materialMap.取消入库料.materialId}',
                warehouseId: '${ciWh2.warehouseId}',
                isDel: 0
              }
            }
          ]
        }
      }, {
        check(result) {
          let data = result.result ?? {}
          let noteA = first(data.noteA)
          let noteF = first(data.noteF)
          let noteB = first(data.noteB)
          assertCancelled(noteA, '采购A')
          assertCancelled(noteF, '采购F')
          assertCancelled(noteB, '门店2采购B')

          assertKeptInstock(first(data.noteHand), '手工入库', { isHand: 1 })
          assertKeptInstock(first(data.noteHand2), '门店2手工入库', { isHand: 1 })
          assertKeptInstock(first(data.noteBack), '退货单', { type: 'back' })
          assertKeptInstock(first(data.noteC), '已对账', { billId: 1 })
          assertKeptInstock(first(data.noteD), '改类型', { type: 'send' })
          let noteE = first(data.noteE)
          assertKeptInstock(noteE, '其他仓库组')
          CheckUtil.expectEqual(Number(noteE.warehouseGroupId), 99999999, 'E的仓库组应保持被改后的值')

          let noteG = first(data.noteG)
          CheckUtil.expectEqual(noteG.status, 'normal', '未入库订单应仍是normal')

          let link = first(data.noteLink)
          let linkBefore = variable.ciLinkBefore
          CheckUtil.expectEqual(link.status ?? null, linkBefore?.status ?? null, '关联单状态应不变')
          CheckUtil.expectEqual(Number(noteA.linkNoteId), Number(variable.ciLink), 'A仍应指向关联单')

          let itemA = first(data.itemA)
          let itemF = first(data.itemF)
          let beforeA = variable.ciAItemBefore
          let beforeF = variable.ciFItemBefore
          assertItemCleared(itemA, '采购A')
          assertItemCleared(itemF, '采购F')
          assertItemCleared(first(data.itemB), '门店2采购B')
          CheckUtil.expectEqual(Number(itemA.yieldRate), 2, 'A的yieldRate应保持2')
          CheckUtil.expectEqual(Number(itemA.backCnt), 1, '已退货采购单的backCnt应保持1')
          CheckUtil.expectEqual(Number(itemA.cnt), Number(beforeA.cnt), 'A的cnt应不变')
          CheckUtil.expectEqual(Number(itemA.price), Number(beforeA.price), 'A的price应不变')
          CheckUtil.expectEqual(Number(itemA.buyUnitFee), Number(beforeA.buyUnitFee), 'A的buyUnitFee应不变')
          CheckUtil.expectEqual(Number(itemF.yieldRate), 4, 'F的yieldRate应保持4')
          CheckUtil.expectEqual(Number(itemF.backCnt), 0, 'F的backCnt应保持0')
          CheckUtil.expectEqual(Number(itemF.cnt), Number(beforeF.cnt), 'F的cnt应不变')
          CheckUtil.expectEqual(Number(itemF.price), Number(beforeF.price), 'F的price应不变')
          CheckUtil.expectEqual(Number(itemF.buyUnitFee), Number(beforeF.buyUnitFee), 'F的buyUnitFee应不变')

          let linkItem = first(data.itemLink)
          let linkItemBefore = variable.ciLinkItemBefore
          CheckUtil.expectEqual(linkItem.status ?? null, linkItemBefore?.status ?? null, '关联明细状态应不变')
          CheckUtil.expectEqual(Number(linkItem.cnt), Number(linkItemBefore?.cnt), '关联明细cnt应不变')
          CheckUtil.expectEqual(Number(linkItem.price), Number(linkItemBefore?.price), '关联明细price应不变')

          let records: any[] = data.records ?? []
          assertRecord(records, itemA.noteItemId, 'Instock', 1, '采购A入库流水应删除')
          assertRecord(records, itemF.noteItemId, 'Instock', 1, '采购F入库流水应删除')
          assertRecord(records, first(data.itemB).noteItemId, 'Instock', 1, '门店2采购B入库流水应删除')
          assertRecord(records, first(data.itemBack).noteItemId, 'Back', 0, '退货流水应保留')
          let handRecords = records.filter(row =>
            String(row.warehouseId) === String(variable.warehouse.warehouseId)
            && row.type === 'handInstock'
            && Number(row.isDel) === 0
          )
          CheckUtil.expectEqual(handRecords.length > 0, true, '门店1手工入库流水应保留')
          let hand2Records = records.filter(row =>
            String(row.warehouseId) === String(variable.ciWh2.warehouseId)
            && row.type === 'handInstock'
            && Number(row.isDel) === 0
          )
          CheckUtil.expectEqual(hand2Records.length > 0, true, '门店2手工入库流水应保留')

          assertStock(first(data.stock1), 5, 50, '门店1')
          assertStock(first(data.stock2), 1, 10, '门店2')
        }
      }),

      ...instockNote('跨页1', 'ciSch1', wh1, 1),
      ...instockNote('跨页2', 'ciSch2', wh1, 1),
      ...instockNote('跨页3', 'ciSch3', wh1, 1),

      cancelInstockBySch()
        .setRemark('同物料已入库。_schParam 带 pageSize=1，反选跨页3'),

      new Action({
        name: '执行跨页取消后的库存重算',
        url: '/free/script/runTimer',
        method: 'POST',
        param: {
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),

      new Action({
        name: '校验跨页全选取消入库',
        remark: '反选的跨页3仍入库；跨页1、跨页2取消。手工单、退货单、已对账、改类型仍跳过',
        url: '/free/query',
        method: 'POST',
        param: {
          array: [
            noteQuery('sch1', '${ciSch1}'),
            noteQuery('sch2', '${ciSch2}'),
            noteQuery('sch3', '${ciSch3}'),
            noteQuery('noteHand', '${ciHand}'),
            noteQuery('noteBack', '${ciBack}'),
            noteQuery('noteC', '${ciNoteC}'),
            noteQuery('noteD', '${ciNoteD}'),
            itemQuery('itemSch1', '${ciSch1}'),
            itemQuery('itemSch2', '${ciSch2}'),
            itemQuery('itemSch3', '${ciSch3}'),
            {
              table: 'stock',
              key: 'stock1',
              query: {
                materialId: '${materialMap.取消入库料.materialId}',
                warehouseId: '${warehouse.warehouseId}',
                isDel: 0
              }
            },
            {
              table: 'stock',
              key: 'stock2',
              query: {
                materialId: '${materialMap.取消入库料.materialId}',
                warehouseId: '${ciWh2.warehouseId}',
                isDel: 0
              }
            }
          ]
        }
      }, {
        check(result) {
          let data = result.result ?? {}
          assertCancelled(first(data.sch1), '跨页1')
          assertCancelled(first(data.sch2), '跨页2')
          assertKeptInstock(first(data.sch3), '反选的跨页3')
          assertItemCleared(first(data.itemSch1), '跨页1')
          assertItemCleared(first(data.itemSch2), '跨页2')
          let itemSch3 = first(data.itemSch3)
          CheckUtil.expectEqual(Number(itemSch3.instockCnt), 1, '反选明细instockCnt应仍是1')
          CheckUtil.expectEqual(isEmpty(itemSch3.instockTime), false, '反选明细instockTime应仍在')
          CheckUtil.expectEqual(isEmpty(itemSch3.instockUser), false, '反选明细instockUser应仍在')
          assertKeptInstock(first(data.noteHand), '手工入库', { isHand: 1 })
          assertKeptInstock(first(data.noteBack), '退货单', { type: 'back' })
          assertKeptInstock(first(data.noteC), '已对账', { billId: 1 })
          assertKeptInstock(first(data.noteD), '改类型', { type: 'send' })
          assertStock(first(data.stock1), 6, 60, '门店1')
          assertStock(first(data.stock2), 1, 10, '门店2')
        }
      })
    ]
  }
}

function cancelInstockBySch(): Action {
  return new Action({
    name: '跨页全选取消入库',
    url: '/app/note/batchCancelInstock',
    method: 'POST',
    param: {
      warehouseGroupId: '${warehouse.warehouseGroupId}',
      _schParam: {
        status: 'instocked',
        materialId: '${materialMap.取消入库料.materialId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        pageSize: 1,
        pageNo: 1,
        _notInIds: []
      }
    }
  }, {
    parseHttpParam(param, variable) {
      param._schParam._notInIds = [variable.ciSch3]
      return param
    }
  }).setHighlight()
}

function instockNote(name: string, key: string, warehouseId: string, cnt: number): BaseTest[] {
  return [
    ...sendOnly(name, key, warehouseId, cnt),
    new Action({
      name: `${name}入库`,
      url: '/app/note/batchProcessNote',
      method: 'POST',
      param: {
        action: 'instock',
        type: 'purcharse',
        noteIds: [],
        warehouseId,
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      parseHttpParam(param, variable) {
        param.noteIds = [variable[key]]
        return param
      }
    })
  ]
}

function sendOnly(name: string, key: string, warehouseId: string, cnt: number = 1): BaseTest[] {
  return [
    new Action({
      name: `${name}下单`,
      url: '/app/note/createNote',
      method: 'POST',
      param: {
        warehouseId,
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        items: [{
          materialId: '${materialMap.取消入库料.materialId}',
          supplierId: '${supplierMap.供应商1}',
          cnt,
          buyUnitFee: 1,
          price: PRICE,
          stockBuyUnitFee: 1
        }]
      }
    }, {
      buildVariable(result) {
        let content = result.result
        let row = Array.isArray(content) ? content[0] : content
        return { [key]: row.noteId }
      }
    }),
    new Action({
      name: `${name}发送`,
      url: '/app/note/sendNote',
      method: 'POST',
      param: {
        noteIds: [],
        status: 'normal',
        warehouseId,
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      parseHttpParam(param, variable) {
        param.noteIds = [variable[key]]
        return param
      }
    })
  ]
}

function handInstock(name: string, warehouseId: string, cnt: number, cost: number, key: string): BaseTest[] {
  return [
    new Action({
      name,
      url: '/app/note/createHandInstock',
      method: 'POST',
      param: {
        warehouseId,
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        items: [{
          materialId: '${materialMap.取消入库料.materialId}',
          supplierId: '${supplierMap.供应商1}',
          cnt,
          buyUnitFee: 1,
          cost,
          price: PRICE,
          stockBuyUnitFee: 1
        }]
      }
    }),
    new Action({
      name: `${name}记下订单`,
      url: '/free/query',
      method: 'POST',
      param: {
        array: [{
          table: 'note',
          key: 'rows',
          query: {
            warehouseId,
            isHand: 1,
            isDel: 0,
            status: 'instocked'
          }
        }, {
          table: 'noteItem',
          key: 'items',
          query: {
            materialId: '${materialMap.取消入库料.materialId}',
            warehouseId,
            isDel: 0
          }
        }]
      }
    }, {
      buildVariable(result) {
        let items: any[] = result.result?.items ?? []
        let noteIds = items.map(row => Number(row.noteId))
        let notes: any[] = result.result?.rows ?? []
        let row = notes.find(note => noteIds.includes(Number(note.noteId)))
        return { [key]: row?.noteId }
      }
    })
  ]
}

function backFrom(noteKey: string, backKey: string): BaseTest[] {
  return [
    new QueryAction({
      name: '读取采购A明细',
      url: '/app/noteItem/listNoteItem',
      query: { noteId: `\${${noteKey}}` }
    }, {
      buildVariable(result) {
        return { ciBackSrc: result.result.content }
      }
    }),
    new Action({
      name: '采购A退1斤',
      url: '/app/noteBack/createNoteBack',
      method: 'POST',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      parseHttpParam(param, variable) {
        let src = (variable.ciBackSrc ?? [])[0]
        param.items = [{
          noteItemId: src.noteItemId,
          stockUnitsId: src.stockUnitsId,
          cnt: 1,
          buyUnitFee: 1,
          price: src.price ?? PRICE,
          supplierId: src.supplierId,
          materialId: src.materialId,
          stockBuyUnitFee: src.stockBuyUnitFee ?? 1
        }]
        return param
      }
    }),
    new Action({
      name: '记下退货单',
      url: '/free/query',
      method: 'POST',
      param: {
        array: [{
          table: 'note',
          key: 'rows',
          query: {
            parenNoteId: `\${${noteKey}}`,
            type: 'back',
            isDel: 0
          }
        }]
      }
    }, {
      buildVariable(result) {
        let row = (result.result?.rows ?? [])[0]
        return { [backKey]: row?.noteId }
      }
    })
  ]
}

function updateRow(name: string, table: string, idCol: string, idKey: string, data: any): Action {
  return new Action({
    name,
    url: '/free/update',
    method: 'POST',
    param: {
      table,
      cdts: [{ col: idCol, val: `\${${idKey}}` }],
      data
    }
  })
}

function noteQuery(key: string, noteId: string) {
  return {
    table: 'note',
    key,
    query: { noteId }
  }
}

function itemQuery(key: string, noteId: string) {
  return {
    table: 'noteItem',
    key,
    query: { noteId, isDel: 0 }
  }
}

function first(rows: any[]): any {
  return (rows ?? [])[0] ?? {}
}

function isEmpty(value: any): boolean {
  return value == null || value === ''
}

function assertCancelled(note: any, label: string) {
  CheckUtil.expectEqual(note.status, 'normal', `${label}应回到normal`)
  CheckUtil.expectEqual(isEmpty(note.instockCost), true, `${label}的instockCost应为null，实际=${note.instockCost}`)
  CheckUtil.expectEqual(isEmpty(note.instockTime), true, `${label}的instockTime应为null，实际=${note.instockTime}`)
}

function assertKeptInstock(note: any, label: string, extra?: Record<string, any>) {
  CheckUtil.expectEqual(note.status, 'instocked', `${label}应仍是instocked`)
  if (extra) {
    for (let col in extra) {
      CheckUtil.expectEqual(
        Number(note[col]) === extra[col] || note[col] === extra[col],
        true,
        `${label}的${col}应是${extra[col]}，实际=${note[col]}`
      )
    }
  }
}

function assertItemCleared(item: any, label: string) {
  CheckUtil.expectEqual(isEmpty(item.instockCnt), true, `${label}明细instockCnt应为null，实际=${item.instockCnt}`)
  CheckUtil.expectEqual(isEmpty(item.instockTime), true, `${label}明细instockTime应为null，实际=${item.instockTime}`)
  CheckUtil.expectEqual(isEmpty(item.instockUser), true, `${label}明细instockUser应为null，实际=${item.instockUser}`)
}

function assertRecord(records: any[], noteItemId: any, type: string, isDel: number, message: string) {
  let matched = records.filter(row =>
    String(row.noteItemId) === String(noteItemId) && row.type === type
  )
  CheckUtil.expectEqual(matched.length > 0, true, `${message}，未找到流水`)
  CheckUtil.expectEqual(
    matched.every(row => Number(row.isDel) === isDel),
    true,
    `${message}，实际=${JSON.stringify(matched.map(row => row.isDel))}`
  )
}

function assertStock(stock: any, cnt: number, cost: number, label: string) {
  CheckUtil.expectEqual(stock != null && stock.materialId != null, true, `${label}应有库存行`)
  CheckUtil.expectEqual(
    StockUtil.isEq(
      { cnt: Number(stock?.cnt ?? 0), buyUnitFee: Number(stock?.buyUnitFee ?? 1) },
      { cnt, buyUnitFee: 1 }
    ),
    true,
    `${label}库存数量应为${cnt}，实际=${stock?.cnt}`
  )
  CheckUtil.expectEqual(Number(stock?.cost), cost, `${label}库存金额应为${cost}，实际=${stock?.cost}`)
}

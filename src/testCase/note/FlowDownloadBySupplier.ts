import { BaseTest, CheckUtil, MultiSheetDownloadAction, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import ListNoteGroup from "../../action/note/ListNoteGroup";

function findRow(rows: any[], col: string, val: any): any {
  let row = (rows ?? []).find(r => r[col] == val);
  CheckUtil.expectEqual(row != null, true, `缺少${col}=${val}的行，实际=${JSON.stringify(rows)}`);
  return row;
}

export default class extends TestCase {
  constructor() {
    super({ remark: '按供应商导订单：多供应商/多状态/退货单负金额/按状态排序' });
  }

  getName(): string {
    return '按供应商导订单';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest().setRemark('初始化餐厅、2个供应商、白菜/鸡蛋/牛肉/羊肉等物料'),
      new Supplier1NormalOrder(),
      new Supplier1InstockedOrder(),
      new Supplier1StatementOrder(),
      new Supplier1BackOrder(),
      new Supplier2NormalOrder(),
      new Supplier2StatementOrder(),
      new CheckDownloadBySupplierExcel({
        name: '下载按供应商订单列表',
        remark: '验证供应商列表汇总和每个供应商的明细 sheet，包含状态排序和退货负金额'
      })
    ];
  }
}

class CheckDownloadBySupplierExcel extends MultiSheetDownloadAction {
  constructor(opt: { name: string; remark: string }) {
    super({
      name: opt.name,
      remark: opt.remark,
      url: '/app/note/downloadBySupplier',
      highlight: true,
      param: {
        begin: '2026-06-01',
        end: '2026-06-30',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    });
  }

  protected async checkResult(sheets: any): Promise<void> {
    await super.checkResult(sheets);
    let sumRows = sheets['供应商列表'];
    CheckUtil.expectEqual(sumRows != null, true, `缺少 sheet「供应商列表」，实际=${JSON.stringify(Object.keys(sheets))}`);
    CheckUtil.expectEqual(sumRows.length, 3, `供应商列表应有 3 行（2 个供应商 + 汇总），实际=${sumRows.length}`);

    let supplier1 = findRow(sumRows, '供应商名称', '供应商1');
    CheckUtil.expectEqual(supplier1['订单数量'], 3, `供应商1订单数量应为 3，实际=${supplier1['订单数量']}`);
    CheckUtil.expectEqual(supplier1['未入库订单数量'], 0, `供应商1未入库订单数量应为 0，实际=${supplier1['未入库订单数量']}`);
    CheckUtil.expectEqual(supplier1['未对账数量'], 2, `供应商1未对账数量应为 2，实际=${supplier1['未对账数量']}`);
    CheckUtil.expectEqual(supplier1['已对账数量'], 1, `供应商1已对账数量应为 1，实际=${supplier1['已对账数量']}`);
    CheckUtil.expectEqual(supplier1['订货金额'], 460, `供应商1订货金额应为 460，实际=${supplier1['订货金额']}`);
    CheckUtil.expectEqual(supplier1['入库金额'], 460, `供应商1入库金额应为 460，实际=${supplier1['入库金额']}`);
    CheckUtil.expectEqual(supplier1['结算金额'], 200, `供应商1结算金额应为 200，实际=${supplier1['结算金额']}`);

    let supplier2 = findRow(sumRows, '供应商名称', '供应商2');
    CheckUtil.expectEqual(supplier2['订单数量'], 2, `供应商2订单数量应为 2，实际=${supplier2['订单数量']}`);
    CheckUtil.expectEqual(supplier2['未入库订单数量'], 1, `供应商2未入库订单数量应为 1，实际=${supplier2['未入库订单数量']}`);
    CheckUtil.expectEqual(supplier2['未对账数量'], 0, `供应商2未对账数量应为 0，实际=${supplier2['未对账数量']}`);
    CheckUtil.expectEqual(supplier2['已对账数量'], 1, `供应商2已对账数量应为 1，实际=${supplier2['已对账数量']}`);
    CheckUtil.expectEqual(supplier2['订货金额'], 160, `供应商2订货金额应为 160，实际=${supplier2['订货金额']}`);
    CheckUtil.expectEqual(supplier2['入库金额'], 60, `供应商2入库金额应为 60，实际=${supplier2['入库金额']}`);
    CheckUtil.expectEqual(supplier2['结算金额'], 60, `供应商2结算金额应为 60，实际=${supplier2['结算金额']}`);

    let totalRow = findRow(sumRows, '供应商名称', '汇总');
    CheckUtil.expectEqual(totalRow['订单数量'], 5, `汇总订单数量应为 5，实际=${totalRow['订单数量']}`);
    CheckUtil.expectEqual(totalRow['未入库订单数量'], 1, `汇总未入库订单数量应为 1，实际=${totalRow['未入库订单数量']}`);
    CheckUtil.expectEqual(totalRow['未对账数量'], 2, `汇总未对账数量应为 2，实际=${totalRow['未对账数量']}`);
    CheckUtil.expectEqual(totalRow['已对账数量'], 2, `汇总已对账数量应为 2，实际=${totalRow['已对账数量']}`);
    CheckUtil.expectEqual(totalRow['订货金额'], 620, `汇总订货金额应为 620，实际=${totalRow['订货金额']}`);
    CheckUtil.expectEqual(totalRow['入库金额'], 520, `汇总入库金额应为 520，实际=${totalRow['入库金额']}`);
    CheckUtil.expectEqual(totalRow['结算金额'], 260, `汇总结算金额应为 260，实际=${totalRow['结算金额']}`);

    let supplier1Rows = sheets['供应商1'];
    CheckUtil.expectEqual(supplier1Rows != null, true, '缺少 sheet「供应商1」');
    CheckUtil.expectEqual(supplier1Rows.length, 4, `供应商1明细应为 4 行（3条 + 汇总），实际=${supplier1Rows.length}`);
    CheckUtil.expectEqual(supplier1Rows[0]['状态名称'], '未对账', `供应商1第一行状态应为未对账，实际=${supplier1Rows[0]['状态名称']}`);
    CheckUtil.expectEqual(supplier1Rows[1]['状态名称'], '未对账', `供应商1第二行状态应为未对账，实际=${supplier1Rows[1]['状态名称']}`);
    CheckUtil.expectEqual(supplier1Rows[2]['状态名称'], '已对账', `供应商1第三行状态应为已对账，实际=${supplier1Rows[2]['状态名称']}`);
    CheckUtil.expectEqual((supplier1Rows ?? []).some((row: any) => row['订单类型'] === '退货单' && row['状态名称'] === '未对账'), true, '供应商1退货单应显示为「退货单 / 未对账」');

    let supplier2Rows = sheets['供应商2'];
    CheckUtil.expectEqual(supplier2Rows != null, true, '缺少 sheet「供应商2」');
    CheckUtil.expectEqual(supplier2Rows[0]['状态名称'], '待入库', `供应商2第一行状态应为待入库，实际=${supplier2Rows[0]['状态名称']}`);
    CheckUtil.expectEqual(supplier2Rows[1]['状态名称'], '已对账', `供应商2第二行状态应为已对账，实际=${supplier2Rows[1]['状态名称']}`);
    CheckUtil.expectEqual((supplier2Rows ?? []).some((row: any) => row['订单类型'] === '订货单' && row['状态名称'] === '待入库'), true, '供应商2新增 6/15 未入库单应显示为「订货单 / 待入库」');

    let materialSheet = sheets['供应商1的物料'];
    CheckUtil.expectEqual(materialSheet != null, true, '缺少 sheet「供应商1的物料」');
    CheckUtil.expectEqual((materialSheet ?? []).some((row: any) => row != null && row['订单号'] != null), true, '供应商1物料表应至少包含一条订单明细');
    CheckUtil.expectEqual((materialSheet ?? []).some((row: any) => row != null && row['物料名'] != null), true, '供应商1物料表应至少包含一条物料记录');
    CheckUtil.expectEqual((materialSheet ?? []).some((row: any) => Number(row['订货数量'] ?? 0) < 0), true, `退货单物料行应出现负数量，实际=${JSON.stringify(materialSheet)}`);
    CheckUtil.expectEqual((materialSheet ?? []).some((row: any) => Number(row['订货金额'] ?? 0) < 0), true, `退货单物料行应出现负金额，实际=${JSON.stringify(materialSheet)}`);
  }
}

class Supplier1NormalOrder extends TestCase {
  constructor() {
    super({ remark: '供应商1：创建未入库订单（白菜 10 @20），状态 normal' });
  }

  getName(): string {
    return '供应商1未入库订单';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote',
        remark: '白菜 10 @20',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.白菜.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 10,
            buyUnitFee: 1,
            price: 20,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let note = result.result[0];
          return { supplier1NormalId: note.noteId, supplier1NormalTitle: note.title };
        }
      }),
      new Action({
        name: 'sendNote',
        remark: '状态改为 normal',
        url: '/app/note/sendNote',
        param: {
          noteIds: ['${supplier1NormalId}'],
          status: 'normal'
        }
      })
    ];
  }
}

class Supplier1InstockedOrder extends TestCase {
  constructor() {
    super({ remark: '供应商1：正常入库订单，状态 instocked，时间 2026-06-05' });
  }

  getName(): string {
    return '供应商1已入库订单';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote',
        remark: '鸡蛋 10 @30',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.鸡蛋.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 10,
            buyUnitFee: 1,
            price: 30,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let note = result.result[0];
          return { supplier1InstockedId: note.noteId, supplier1InstockedTitle: note.title, supplier1InstockedNote: note };
        }
      }),
      new Action({
        name: 'sendNote',
        remark: '状态 normal',
        url: '/app/note/sendNote',
        param: {
          noteIds: ['${supplier1InstockedId}'],
          status: 'normal'
        }
      }),
      new ListNoteGroup({ groupType: 'NoteDay', status: 'normal' }).setRemark('查询待入库分组，供 processNote 使用'),
      new Action({
        name: 'processNote',
        remark: '按订单明细全量入库',
        url: '/app/note/processNote',
        param: {
          noteId: '${supplier1InstockedNote.noteId}',
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(param: any, variable: any) {
          let noteItems: any[] = variable.supplier1InstockedNote.noteItems;
          param.noteItems = noteItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            cnt: row.cnt,
            instockCnt: row.cnt,
            price: row.price,
            stockBuyUnitFee: row.stockBuyUnitFee,
            materialId: row.materialId,
            yieldRate: 0
          }));
          return param;
        }
      }),
      new Action({
        name: 'updateNoteTime',
        remark: '时间改为 2026-06-05',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${supplier1InstockedId}',
          sysAddTime: '2026-06-05 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ];
  }
}

class Supplier1StatementOrder extends TestCase {
  constructor() {
    super({ remark: '供应商1：另起一单正常入库并确认结算，状态 statement' });
  }

  getName(): string {
    return '供应商1已结算订单';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote',
        remark: '羊肉 5 @40',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.羊肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 5,
            buyUnitFee: 1,
            price: 40,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let note = result.result[0];
          return { supplier1StatementId: note.noteId, supplier1StatementTitle: note.title, supplier1StatementNote: note };
        }
      }),
      new Action({
        name: 'sendNote',
        remark: '状态 normal',
        url: '/app/note/sendNote',
        param: {
          noteIds: ['${supplier1StatementId}'],
          status: 'normal'
        }
      }),
      new ListNoteGroup({ groupType: 'NoteDay', status: 'normal' }).setRemark('查询待入库分组，供 processNote 使用'),
      new Action({
        name: 'processNote',
        remark: '入库羊肉',
        url: '/app/note/processNote',
        param: {
          noteId: '${supplier1StatementNote.noteId}',
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(param: any, variable: any) {
          let noteItems: any[] = variable.supplier1StatementNote.noteItems;
          param.noteItems = noteItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            cnt: row.cnt,
            instockCnt: row.cnt,
            price: row.price,
            stockBuyUnitFee: row.stockBuyUnitFee,
            materialId: row.materialId,
            yieldRate: 0
          }));
          return param;
        }
      }),
      new Action({
        name: 'updateNoteTime',
        remark: '时间改为 2026-06-15',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${supplier1StatementId}',
          sysAddTime: '2026-06-15 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),
      new Action({
        name: 'createBill',
        remark: '把该订单加入对账单',
        url: '/app/bill/createBill',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          noteIds:['${supplier1StatementId}']
        }
      }, {
        // parseHttpParam(param: any) {
        //   param.noteIds = ['${supplier1StatementId}'];
        //   return param;
        // },
        buildVariable(result) {
          return {
            supplier1BillId: result.result.billId,
            billId: result.result.billId
          };
        }
      }),
      new Action({
        name: 'setBillStatus',
        remark: '确认对账，状态改为 statement',
        url: '/app/bill/setBillStatus',
        param: {
          billId: '${billId}',
          status: 'confirm'
        }
      })
    ];
  }
}

class Supplier1BackOrder extends TestCase {
  constructor() {
    super({ remark: '供应商1：退货单，订货金额和入库金额都为负数' });
  }

  getName(): string {
    return '供应商1退货单';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '查询白菜订单明细',
        remark: '以 6/1 正常入库单为退货来源',
        url: '/app/noteItem/listNoteItem',
        param: {
          noteId: '${supplier1NormalId}'
        }
      }, {
        buildVariable(result) {
          return { supplier1BackSrc: result.result.content };
        }
      }),
      new Action({
        name: 'createNoteBack',
        remark: '退白菜 2 @20',
        url: '/app/noteBack/createNoteBack',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(param: any, variable: any) {
          let cabbageId = variable.materialMap.白菜.materialId;
          let src = (variable.supplier1BackSrc ?? []).find((row: any) => row.materialId == cabbageId);
          CheckUtil.expectEqual(src != null, true, `未找到供应商1白菜单对应 noteItem，noteId=${variable.supplier1NormalId}，materialId=${cabbageId}`);
          param.items = [{
            noteItemId: src.noteItemId,
            stockUnitsId: src.stockUnitsId,
            cnt: 2,
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
        name: '查询退货单',
        remark: '记下退货单号',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          status: 'instocked',
          type: 'back'
        }
      }, {
        buildVariable(result) {
          let note = result.result.content[0];
          return { supplier1BackId: note.noteId, supplier1BackTitle: note.title };
        }
      }),
      new Action({
        name: 'updateNoteTime',
        remark: '退货单时间改为 2026-06-15，确保它仍在 6/1-6/30 导出区间内',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${supplier1BackId}',
          sysAddTime: '2026-06-15 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ];
  }
}

class Supplier2NormalOrder extends TestCase {
  constructor() {
    super({ remark: '供应商2：普通订单未入库，状态 normal；新增一笔 6/15 100 元未入库单' });
  }

  getName(): string {
    return '供应商2未入库订单';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote',
        remark: '牛肉 4 @15',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商2}',
            cnt: 4,
            buyUnitFee: 1,
            price: 15,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let note = result.result[0];
          return { supplier2NormalId: note.noteId, supplier2NormalTitle: note.title };
        }
      }),
      new Action({
        name: '更新未入库状态',
        remark: '把第一笔供应商2未入库单直接改为 normal',
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [
            { col: 'noteId', val: '${supplier2NormalId}' }
          ],
          data: { status: 'normal' }
        }
      }),
      new Action({
        name: 'createNote',
        remark: '牛肉 5 @20，时间 2026-06-15，金额 100 元，仍未入库',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商2}',
            cnt: 5,
            buyUnitFee: 1,
            price: 20,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let note = result.result[0];
          return { supplier2JuneNormalId: note.noteId, supplier2JuneNormalTitle: note.title };
        }
      }),
      new Action({
        name: '更新新增未入库状态',
        remark: '把新增 6/15 未入库订单直接改为 normal',
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [
            { col: 'noteId', val: '${supplier2JuneNormalId}' }
          ],
          data: { status: 'normal',createTime:'2026-06-15' }
        }
      })
      
    ];
  }
}

class Supplier2StatementOrder extends TestCase {
  constructor() {
    super({ remark: '供应商2：已结算订单，状态 statement' });
  }

  getName(): string {
    return '供应商2已结算订单';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote',
        remark: '牛肉 2 @30',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商2}',
            cnt: 2,
            buyUnitFee: 1,
            price: 30,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let note = result.result[0];
          return { supplier2StatementId: note.noteId, supplier2StatementTitle: note.title, supplier2StatementNote: note };
        }
      }),
      new Action({
        name: 'sendNote',
        remark: '状态 normal',
        url: '/app/note/sendNote',
        param: {
          noteIds: ['${supplier2StatementId}'],
          status: 'normal'
        }
      }),
      new ListNoteGroup({ groupType: 'NoteDay', status: 'normal' }).setRemark('查询待入库分组，供 processNote 使用'),
      new Action({
        name: 'processNote',
        remark: '牛肉入库',
        url: '/app/note/processNote',
        param: {
          noteId: '${supplier2StatementNote.noteId}',
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(param: any, variable: any) {
          let noteItems: any[] = variable.supplier2StatementNote.noteItems;
          param.noteItems = noteItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            cnt: row.cnt,
            instockCnt: row.cnt,
            price: row.price,
            stockBuyUnitFee: row.stockBuyUnitFee,
            materialId: row.materialId,
            yieldRate: 0
          }));
          return param;
        }
      }),
      new Action({
        name: 'updateNoteTime',
        remark: '时间改为 2026-06-25',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${supplier2StatementId}',
          sysAddTime: '2026-06-25 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),
      new Action({
        name: 'createBill',
        remark: '把该订单加入对账单',
        url: '/app/bill/createBill',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          noteIds: ['${supplier2StatementId}']
        }
      }, {
        buildVariable(result) {
          return {
            supplier2BillId: result.result.billId,
            billId: result.result.billId
          };
        }
      }),
      new Action({
        name: 'setBillStatus',
        remark: '确认对账，状态改为 statement',
        url: '/app/bill/setBillStatus',
        param: {
          billId: '${billId}',
          status: 'confirm'
        }
      })
    ];
  }
}

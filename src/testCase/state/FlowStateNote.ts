import { BaseTest, CheckUtil, DateUtil, MultiSheetDownloadAction, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import ListNoteGroup from "../../action/note/ListNoteGroup";

const EMPTY_COLS = ['已付', '未付', '印花税税额', '印花税缴纳月份'];

function isEmptyCell(val: any): boolean {
  return val == null || val === '';
}

function asDay(val: any): string {
  if (val == null) {
    return '';
  }
  if (typeof val === 'string') {
    return val.replace(/\//g, '-').substring(0, 10);
  }
  if (val instanceof Date) {
    return DateUtil.format(val);
  }
  return String(val);
}

function findRow(rows: any[], col: string, val: any): any {
  let row = rows.find(r => r[col] == val);
  CheckUtil.expectEqual(row != null, true, `缺少${col}=${val}的行，实际=${JSON.stringify(rows)}`);
  return row;
}

function checkEmptyPayCols(row: any, tag: string) {
  for (let col of EMPTY_COLS) {
    CheckUtil.expectEqual(isEmptyCell(row[col]), true, `${tag}.${col}应为空，实际=${row[col]}`);
  }
}

function checkSumRow(rows: any[], name: string, cost: number) {
  let row = findRow(rows, '供应商名称', name);
  CheckUtil.expectEqual(row['应付账款'], cost, `${name}.应付账款期望${cost}，实际${row['应付账款']}`);
  checkEmptyPayCols(row, name);
}

function checkNoteRow(row: any, expect: {
  title: string;
  day: string;
  materialCnt: number;
  instockCost: number;
  statementCost: number;
  rate: any;
  remark: string;
}) {
  let tag = expect.title;
  CheckUtil.expectEqual(row['订单号'], expect.title, `${tag}.订单号`);
  CheckUtil.expectEqual(asDay(row['日期']), expect.day, `${tag}.日期期望${expect.day}，实际${asDay(row['日期'])}`);
  CheckUtil.expectEqual(row['物料数量'], expect.materialCnt, `${tag}.物料数量`);
  CheckUtil.expectEqual(row['入库金额'], expect.instockCost, `${tag}.入库金额`);
  CheckUtil.expectEqual(row['结算金额'], expect.statementCost, `${tag}.结算金额`);
  CheckUtil.expectEqual(row['评分'], expect.rate, `${tag}.评分`);
  CheckUtil.expectEqual(row['评价'] ?? '', expect.remark, `${tag}.评价`);
}

function buildNoteExpects(): { [key: string]: (variable: any) => any } {
  return {
    A: (variable) => ({
      title: variable.noteATitle,
      day: '2026-06-01',
      materialCnt: 2,
      instockCost: 400,
      statementCost: 400,
      rate: 5,
      remark: '货好'
    }),
    B: (variable) => ({
      title: variable.noteBTitle,
      day: '2026-06-05',
      materialCnt: 1,
      instockCost: 100,
      statementCost: 100,
      rate: '没有评分',
      remark: ''
    }),
    C: (variable) => ({
      title: variable.noteCTitle,
      day: '2026-06-10',
      materialCnt: 1,
      instockCost: -40,
      statementCost: -40,
      rate: '没有评分',
      remark: ''
    }),
    D: (variable) => ({
      title: variable.noteDTitle,
      day: '2026-06-15',
      materialCnt: 1,
      instockCost: 200,
      statementCost: 200,
      rate: '没有评分',
      remark: ''
    })
  };
}

interface ExcelCheckOpt {
  name: string;
  remark: string;
  sum: { name: string; cost: number }[];
  supplier1?: Array<'A' | 'B' | 'C'>;
  supplier2?: Array<'D'>;
}

/**
 * 供应商应付账款 `/app/state/stateNote`（见同目录 FlowStateNote.md）。
 * 对账单确认路径：createBill / removeNote / addNote2Bill / setBillStatus。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '供应商应付账款：多供应商/多物料/评价/手动入库/退货/对账单增删确认' });
  }

  getName(): string {
    return '供应商应付账款';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest().setRemark('初始化餐厅、供应商1/2、物料'),
      new InstockNoteA(),
      new HandInstockNoteB(),
      new BackNoteC(),
      new InstockNoteD(),
      new InstockNoteE(),
      new Action({
        name: '供应商1加入对账单',
        remark: 'createBill：正常入库+手动入库+退货三张单',
        url: '/app/bill/createBill',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(param, variable) {
          param.noteIds = [variable.noteAId, variable.noteBId, variable.noteCId];
          return param;
        },
        check(result) {
          let bill = result.result;
          CheckUtil.expectEqual(bill.noteCnt, 3, `供应商1对账单 noteCnt 期望3，实际${bill.noteCnt}`);
        },
        buildVariable(result) {
          return { billId1: result.result.billId };
        }
      }),
      new Action({
        name: '从对账单删除手动入库单',
        remark: 'removeNote 去掉 6/5 手动入库单',
        url: '/app/bill/removeNote',
        param: {
          billId: '${billId1}',
          noteId: '${noteBId}',
          remark: '先不对这笔手动入库对账'
        }
      }),
      new Action({
        name: '供应商2加入对账单',
        remark: 'createBill：6/15 与 7/1 两张牛肉单',
        url: '/app/bill/createBill',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(param, variable) {
          param.noteIds = [variable.noteDId, variable.noteEId];
          return param;
        },
        check(result) {
          let bill = result.result;
          CheckUtil.expectEqual(bill.noteCnt, 2, `供应商2对账单 noteCnt 期望2，实际${bill.noteCnt}`);
        },
        buildVariable(result) {
          return { billId2: result.result.billId };
        }
      }),
      new ConfirmBothBills(),
      this.buildExcelCheck({
        name: '删单后首次下载',
        remark: '确认后下载：供应商1=360（无手动入库），供应商2=200（无7/1）',
        sum: [
          { name: '供应商1', cost: 360 },
          { name: '供应商2', cost: 200 }
        ],
        supplier1: ['A', 'C'],
        supplier2: ['D']
      }),
      new Action({
        name: '取消确认供应商1对账单',
        remark: 'setBillStatus status=normal，订单回到 instocked',
        url: '/app/bill/setBillStatus',
        param: {
          billId: '${billId1}',
          status: 'normal'
        }
      }),
      this.buildExcelCheck({
        name: '取消确认后下载',
        remark: '取消后汇总只剩供应商2=200',
        sum: [
          { name: '供应商2', cost: 200 }
        ],
        supplier2: ['D']
      }),
      new AddBackAndConfirm(),
      this.buildExcelCheck({
        name: '加回手动入库后再下载',
        remark: '供应商1=460，明细 6/1、6/5、6/10 三行',
        sum: [
          { name: '供应商1', cost: 460 },
          { name: '供应商2', cost: 200 }
        ],
        supplier1: ['A', 'B', 'C'],
        supplier2: ['D']
      })
    ];
  }

  private buildExcelCheck(opt: ExcelCheckOpt): CheckStateNoteExcel {
    return new CheckStateNoteExcel(opt);
  }
}

interface InstockItem {
  material: string;
  cnt: number;
  price: number;
}

/** 正常入库：createNote → sendNote → processNote → updateNoteTime */
class InstockByOrder extends TestCase {
  private opt: {
    remark: string;
    name: string;
    day: string;
    supplier: string;
    items: InstockItem[];
    idKey: string;
    titleKey: string;
    rate?: number;
    rateRemark?: string;
  };

  constructor(opt: InstockByOrder['opt']) {
    super({ remark: opt.remark });
    this.opt = opt;
  }

  getName(): string {
    return this.opt.name;
  }

  protected buildActions(): BaseTest[] {
    let opt = this.opt;
    let ret: BaseTest[] = [
      new Action({
        name: `createNote(${opt.name})`,
        remark: opt.remark,
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: opt.items.map(item => ({
            materialId: `\${materialMap.${item.material}.materialId}`,
            supplierId: `\${supplierMap.${opt.supplier}}`,
            cnt: item.cnt,
            buyUnitFee: 1,
            price: item.price,
            stockBuyUnitFee: 1
          }))
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result;
          let note = content[0];
          return {
            noteIds: content.map(row => row.noteId),
            note,
            [opt.idKey]: note.noteId,
            [opt.titleKey]: note.title
          };
        }
      }),
      new Action({
        name: '发送订单',
        remark: 'sendNote，状态 normal',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal'
      }).setRemark('查询待入库分组，供 processNote 使用'),
      new Action({
        name: '入库processNote',
        remark: '按订单明细全量入库',
        url: '/app/note/processNote',
        param: {
          noteId: '${note.noteId}',
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(param: any, variable: any) {
          let noteItems: any[] = variable.note.noteItems;
          param.noteItems = noteItems.map(row => ({
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
        name: `修改订单时间为${opt.day}`,
        remark: `updateNoteTime → ${opt.day}`,
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${note.noteId}',
          sysAddTime: `${opt.day} 00:00:00`,
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),
      new Action({
        name: '记下订单号',
        remark: `listNote 记下 ${opt.titleKey}`,
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          noteId: `\${${opt.idKey}}`
        }
      }, {
        buildVariable(result) {
          let note = result.result.content[0];
          return {
            [opt.titleKey]: note.title
          };
        }
      })
    ];
    if (opt.rate != null) {
      ret.push(new Action({
        name: '订单评分',
        remark: `setRate ${opt.rate}，评价 ${opt.rateRemark}`,
        url: '/app/note/setRate',
        param: {
          tableId: `\${${opt.idKey}}`,
          tableName: 'note',
          rate: opt.rate,
          remark: opt.rateRemark,
          rateType: 'instocked'
        }
      }));
      ret.push(new Action({
        name: '回写订单评价',
        remark: `把评价写入 note.remark=${opt.rateRemark}`,
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [
            { col: 'noteId', val: `\${${opt.idKey}}` }
          ],
          data: { remark: opt.rateRemark }
        }
      }));
    }
    return ret;
  }
}

class InstockNoteA extends InstockByOrder {
  constructor() {
    super({
      remark: '供应商1正常入库：白菜10+鸡蛋10 @20，日期6/1，评分5评价货好',
      name: '供应商1正常入库',
      day: '2026-06-01',
      supplier: '供应商1',
      items: [
        { material: '白菜', cnt: 10, price: 20 },
        { material: '鸡蛋', cnt: 10, price: 20 }
      ],
      idKey: 'noteAId',
      titleKey: 'noteATitle',
      rate: 5,
      rateRemark: '货好'
    });
  }
}

class InstockNoteD extends InstockByOrder {
  constructor() {
    super({
      remark: '供应商2正常入库：牛肉10 @20，日期6/15',
      name: '供应商2正常入库6/15',
      day: '2026-06-15',
      supplier: '供应商2',
      items: [
        { material: '牛肉', cnt: 10, price: 20 }
      ],
      idKey: 'noteDId',
      titleKey: 'noteDTitle'
    });
  }
}

class InstockNoteE extends InstockByOrder {
  constructor() {
    super({
      remark: '供应商2正常入库：牛肉10 @20，日期7/1（6月报表不应包含）',
      name: '供应商2正常入库7/1',
      day: '2026-07-01',
      supplier: '供应商2',
      items: [
        { material: '牛肉', cnt: 10, price: 20 }
      ],
      idKey: 'noteEId',
      titleKey: 'noteETitle'
    });
  }
}

class HandInstockNoteB extends TestCase {
  constructor() {
    super({ remark: '供应商1手动入库：白菜5 @20，salesDay=2026-06-05' });
  }

  getName(): string {
    return '供应商1手动入库';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createHandInstock',
        remark: '手动入库白菜5@20，salesDay=2026-06-05',
        url: '/app/note/createHandInstock',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          salesDay: '2026-06-05',
          items: [
            {
              materialId: '${materialMap.白菜.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 5,
              buyUnitFee: 1,
              price: 20,
              stockBuyUnitFee: 1
            }
          ]
        }
      }),
      new Action({
        name: '查询手动入库单',
        remark: 'listNote isHand=1，记下 noteBId/title',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          status: 'instocked'
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content;
          let note = content.find(row => row.isHand == 1);
          CheckUtil.expectEqual(note != null, true, '未找到手动入库单');
          return {
            noteBId: note.noteId,
            noteBTitle: note.title
          };
        }
      })
    ];
  }
}

class BackNoteC extends TestCase {
  constructor() {
    super({ remark: '供应商1退货：从6/1订单退白菜2，日期6/10' });
  }

  getName(): string {
    return '供应商1退货';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '查询6/1订单明细',
        remark: '取白菜 noteItem 作退货源',
        url: '/app/noteItem/listNoteItem',
        param: {
          noteId: '${noteAId}'
        }
      }, {
        buildVariable(result) {
          return { backSrcItems: result.result.content };
        }
      }),
      new Action({
        name: '创建退货单',
        remark: '退白菜2 @20',
        url: '/app/noteBack/createNoteBack',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(param: any, variable: any) {
          let cabbageId = variable.materialMap.白菜.materialId;
          let src = variable.backSrcItems.find((row: any) => row.materialId == cabbageId);
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
        remark: '记下 noteCId/title',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          status: 'instocked',
          type: 'back'
        }
      }, {
        buildVariable(result) {
          let note = result.result.content[0];
          return {
            noteCId: note.noteId,
            noteCTitle: note.title
          };
        }
      }),
      new Action({
        name: '修改退货单时间为6月10日',
        remark: 'updateNoteTime → 2026-06-10',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${noteCId}',
          sysAddTime: '2026-06-10 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ];
  }
}

class ConfirmBothBills extends TestCase {
  constructor() {
    super({ remark: '确认供应商1、供应商2对账单，订单变为 statement' });
  }

  getName(): string {
    return '确认对账单';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '确认供应商1对账单',
        remark: 'setBillStatus confirm，不含已移除的手动入库单',
        url: '/app/bill/setBillStatus',
        param: {
          billId: '${billId1}',
          status: 'confirm'
        }
      }),
      new Action({
        name: '确认供应商2对账单',
        remark: 'setBillStatus confirm，含6/15与7/1',
        url: '/app/bill/setBillStatus',
        param: {
          billId: '${billId2}',
          status: 'confirm'
        }
      })
    ];
  }
}

class AddBackAndConfirm extends TestCase {
  constructor() {
    super({ remark: '把手动入库单加回对账单并再次确认' });
  }

  getName(): string {
    return '加回手动入库并确认';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '加回手动入库单',
        remark: 'addNote2Bill noteB',
        url: '/app/bill/addNote2Bill',
        param: {
          billId: '${billId1}',
          noteId: '${noteBId}',
          remark: '加回手动入库'
        }
      }),
      new Action({
        name: '再次确认供应商1对账单',
        remark: 'setBillStatus confirm，含手动入库',
        url: '/app/bill/setBillStatus',
        param: {
          billId: '${billId1}',
          status: 'confirm'
        }
      })
    ];
  }
}

class CheckStateNoteExcel extends MultiSheetDownloadAction {
  private checkOpt: ExcelCheckOpt;

  constructor(opt: ExcelCheckOpt) {
    super({
      name: opt.name,
      remark: opt.remark,
      url: '/app/state/stateNote',
      highlight: true,
      param: {
        begin: '2026-06-01',
        end: '2026-06-30',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    });
    this.checkOpt = opt;
  }

  protected async checkResult(sheets: any): Promise<void> {
    await super.checkResult(sheets);
    let variable = this.getVariable();
    let opt = this.checkOpt;
    let sumRows = sheets['应付款汇总'];
    CheckUtil.expectEqual(sumRows != null, true,
      `缺少sheet「应付款汇总」，实际=${JSON.stringify(Object.keys(sheets))}`);
    CheckUtil.expectEqual(sumRows.length, opt.sum.length + 1,
      `应付款汇总行数期望${opt.sum.length + 1}（含汇总），实际${sumRows.length}，${JSON.stringify(sumRows)}`);
    for (let item of opt.sum) {
      checkSumRow(sumRows, item.name, item.cost);
    }
    let totalRow = findRow(sumRows, '供应商名称', '汇总');
    let totalCost = opt.sum.reduce((s, item) => s + item.cost, 0);
    CheckUtil.expectEqual(totalRow['应付账款'], totalCost,
      `应付款汇总.汇总.应付账款期望${totalCost}，实际${totalRow['应付账款']}`);
    checkEmptyPayCols(totalRow, '汇总');
    this.checkSupplierSheet(sheets, '供应商1', opt.supplier1, variable);
    this.checkSupplierSheet(sheets, '供应商2', opt.supplier2, variable);
  }

  private checkSupplierSheet(
    sheets: any,
    sheetName: string,
    keys: string[],
    variable: any
  ) {
    let rows = sheets[sheetName];
    if (keys == null) {
      CheckUtil.expectEqual(rows == null, true,
        `不应有 sheet「${sheetName}」，实际=${JSON.stringify(rows)}`);
      return;
    }
    CheckUtil.expectEqual(rows != null, true,
      `缺少sheet「${sheetName}」，实际=${JSON.stringify(Object.keys(sheets))}`);
    let expects = buildNoteExpects();
    CheckUtil.expectEqual(rows.length, keys.length + 1,
      `${sheetName}行数期望${keys.length + 1}（含汇总），实际${rows.length}，${JSON.stringify(rows)}`);
    let instockCost = 0;
    let statementCost = 0;
    for (let i = 0; i < keys.length; i++) {
      let expect = expects[keys[i]](variable);
      checkNoteRow(rows[i], expect);
      instockCost += expect.instockCost;
      statementCost += expect.statementCost;
    }
    let totalRow = rows[keys.length];
    CheckUtil.expectEqual(totalRow['订单号'], '汇总', `${sheetName}最后一行应为汇总`);
    CheckUtil.expectEqual(totalRow['入库金额'], instockCost,
      `${sheetName}.汇总.入库金额期望${instockCost}，实际${totalRow['入库金额']}`);
    CheckUtil.expectEqual(totalRow['结算金额'], statementCost,
      `${sheetName}.汇总.结算金额期望${statementCost}，实际${totalRow['结算金额']}`);
  }
}


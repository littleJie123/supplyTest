import { BaseTest, CheckUtil, DownloadExcelAction, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import SaveShareData from "../../action/shareData/SaveShareData";
import BatchProcessNote from "../../action/note/BatchProcessNote";

function findRow(rows: any[], col: string, val: any): any {
  let row = (rows ?? []).find(r => r[col] == val);
  CheckUtil.expectEqual(row != null, true, `缺少${col}=${val}的行，实际=${JSON.stringify(rows)}`);
  return row;
}

function checkRateCols(rows: any[], variable: any) {
  let rated = findRow(rows, '订单号', variable.noteRatedTitle);
  CheckUtil.expectEqual(rated['评分'], 5, `已评分单.评分期望5，实际=${rated['评分']}`);
  CheckUtil.expectEqual(rated['评价'] ?? '', '货好', `已评分单.评价期望货好，实际=${rated['评价']}`);

  let unrated = findRow(rows, '订单号', variable.noteUnratedTitle);
  CheckUtil.expectEqual(unrated['评分'], '没有评分', `未评分单.评分期望没有评分，实际=${unrated['评分']}`);
  CheckUtil.expectEqual(unrated['评价'] ?? '', '', `未评分单.评价应为空，实际=${unrated['评价']}`);
}

/**
 * 下载订单一览的评分/评价（见同目录 FlowDownloadNotesRate.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '下载订单一览：已评分显示分数和评价，未评分显示没有评分' });
  }

  getName(): string {
    return '下载订单一览评分';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest().setRemark('初始化餐厅、供应商、物料'),
      new PrepRatedNote(),
      new PrepUnratedNote(),
      new ListNoteGroup({
        groupType: 'NoteDay',
        len: 1,
        noteCnt: 2
      }).setRemark('当日分组应有2单'),
      new SaveShareData({
        data: {
          group: {
            groupType: 'NoteDay',
            status: 'normal',
            sysAddTime: '${noteGroup.day}'
          },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }).setRemark('分享当日分组，供 downloadNotes 使用'),
      new CheckNoteSumExcel({
        name: 'downloadNotes订单一览',
        remark: '已评分=5/货好，未评分=没有评分',
        url: '/app/note/downloadNotes',
        param: {
          shareDataNo: '${shareDataNo}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),
      new BatchProcessNote({
        action: 'instock'
      }).setRemark('两单入库，供对账单下载'),
      new Action({
        name: '生成对账单',
        remark: 'createBill 把已评分、未评分两单加入对账单',
        url: '/app/bill/createBill',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(param, variable) {
          param.noteIds = [variable.noteRatedId, variable.noteUnratedId];
          return param;
        },
        buildVariable(result) {
          return { billId: result.result.billId };
        }
      }),
      new CheckNoteSumExcel({
        name: 'downBill订单一览',
        remark: '对账单下载订单一览，评分/评价与 downloadNotes 一致',
        url: '/app/bill/downBill',
        param: {
          billId: '${billId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ];
  }
}

class CheckNoteSumExcel extends DownloadExcelAction {
  constructor(opt: { name: string; remark: string; url: string; param: any }) {
    super({
      name: opt.name,
      remark: opt.remark,
      url: opt.url,
      sheetName: '订单一览',
      param: opt.param
    });
  }

  protected async checkResult(result: any): Promise<void> {
    await super.checkResult(result);
    checkRateCols(result, this.getVariable());
  }
}

class PrepRatedNote extends TestCase {
  constructor() {
    super({ remark: '白菜10@20 发单后评分5、评价货好' });
  }

  getName(): string {
    return '创建已评分订单';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote已评分',
        remark: '白菜10@20',
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
          let notes: any[] = result.result;
          let note = notes[0];
          return {
            noteRatedId: note.noteId,
            noteRatedTitle: note.title,
            noteIds: notes.map(row => row.noteId)
          };
        }
      }),
      new Action({
        name: '发送已评分订单',
        remark: 'sendNote，状态 normal',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }),
      new Action({
        name: '记下已评分订单号',
        remark: 'listNote 记下 noteRatedTitle',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          noteId: '${noteRatedId}'
        }
      }, {
        buildVariable(result) {
          let note = result.result.content[0];
          return { noteRatedTitle: note.title };
        }
      }),
      new Action({
        name: '订单评分',
        remark: 'setRate 5，评价货好',
        url: '/app/note/setRate',
        param: {
          tableId: '${noteRatedId}',
          tableName: 'note',
          rate: 5,
          remark: '货好',
          rateType: 'normal'
        }
      }),
      new Action({
        name: '回写订单评价',
        remark: '把评价写入 note.remark=货好',
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [
            { col: 'noteId', val: '${noteRatedId}' }
          ],
          data: { remark: '货好' }
        }
      })
    ];
  }
}

class PrepUnratedNote extends TestCase {
  constructor() {
    super({ remark: '鸡蛋10@20 发单，不评分' });
  }

  getName(): string {
    return '创建未评分订单';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote未评分',
        remark: '鸡蛋10@20',
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
            price: 20,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let notes: any[] = result.result;
          let note = notes[0];
          return {
            noteUnratedId: note.noteId,
            noteUnratedTitle: note.title,
            noteIds: notes.map(row => row.noteId)
          };
        }
      }),
      new Action({
        name: '发送未评分订单',
        remark: 'sendNote，状态 normal',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }),
      new Action({
        name: '记下未评分订单号',
        remark: 'listNote 记下 noteUnratedTitle',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          noteId: '${noteUnratedId}'
        }
      }, {
        buildVariable(result) {
          let note = result.result.content[0];
          return { noteUnratedTitle: note.title };
        }
      })
    ];
  }
}

import { BaseTest, CheckUtil, DateUtil, DownloadExcelAction, HttpAction, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import SaveShareData from "../../action/shareData/SaveShareData";
import BatchProcessNote from "../../action/note/BatchProcessNote";

function dayStr(daysBefore: number): string {
  return DateUtil.format(DateUtil.beforeDay(new Date(), daysBefore));
}

function dayTime(daysBefore: number): string {
  return `${dayStr(daysBefore)} 00:00:00`;
}

/**
 * 验证 downloadNotes 物料一览：同物料多单、不同下单单位（瓶/箱）汇总后数量正确。
 * 场景含：当日混单位；前天瓶 + 昨天箱。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: 'downloadNotes 物料一览：瓶/箱混单位汇总（含跨日）' });
  }

  getName(): string {
    return '下载物料一览汇总单位';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest().setRemark('初始化餐厅、供应商、物料'),
      new PrepBeefBoxBottle().setRemark('牛肉改为1箱=5瓶，记下箱/瓶 unitsId'),
      new SceneSameDayMix().setRemark('场景1：当日 4瓶 + 2箱 → 物料一览 14瓶'),
      new SceneCrossDayMix().setRemark('场景2：前天瓶 + 昨天箱 → 分日/跨日下载'),
    ];
  }
}

/** 查箱/瓶单位 + 牛肉规格改为 1箱=5瓶 */
class PrepBeefBoxBottle extends TestCase {
  constructor() {
    super({ remark: '准备：箱/瓶 unitsId + 牛肉规格' });
  }

  getName(): string {
    return '准备牛肉瓶箱规格';
  }

  protected buildActions(): BaseTest[] {
    return [
      new HttpAction({
        name: 'query查箱瓶单位',
        url: '/free/query',
        method: 'POST',
        param: {
          array: [{
            table: 'units',
            query: {
              name: ['箱', '瓶'],
              isDel: 0
            }
          }]
        }
      }, {
        buildVariable(result) {
          const list = result.result?.units ?? [];
          const box = list.find((row: any) => row.name === '箱');
          const bottle = list.find((row: any) => row.name === '瓶');
          if (box?.unitsId == null) {
            throw new Error(`units 未查到箱: ${JSON.stringify(list)}`);
          }
          if (bottle?.unitsId == null) {
            throw new Error(`units 未查到瓶: ${JSON.stringify(list)}`);
          }
          return {
            boxUnitsId: box.unitsId,
            bottleUnitsId: bottle.unitsId
          };
        }
      }).setRemark('free/query units（箱/瓶）'),

      new Action({
        name: '牛肉规格改为瓶箱',
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${materialMap.牛肉.materialId}',
          name: '牛肉',
          category: { categoryId: '${categoryMap.肉类}' },
          buyUnit: [
            { name: '瓶' },
            { name: '箱', isSupplier: true, fee: 5 }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商2}',
            price: 10
          }],
          img: [],
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }).setRemark('牛肉：1箱=5瓶，采购单位箱')
    ];
  }
}

/**
 * 场景1：同一天 4瓶 + 2箱，NoteDay 下载物料一览 → 14瓶
 */
class SceneSameDayMix extends TestCase {
  constructor() {
    super({ remark: '场景1：当日4瓶+2箱，物料一览=14瓶' });
  }

  getName(): string {
    return '场景1-当日混单位';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '当日下单4瓶',
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
            stockUnitsId: '${bottleUnitsId}',
            price: 10,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : [];
          return {
            noteIdSameDayBottle: notes[0]?.noteId,
            noteIdsSameDayBottle: notes.map((row: any) => row.noteId)
          };
        }
      }).setRemark('当日第一单：4瓶'),

      new Action({
        name: '发单当日4瓶',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIdsSameDayBottle}',
          status: 'normal'
        }
      }).setRemark('发当日4瓶单'),

      new Action({
        name: '当日下单2箱',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商2}',
            cnt: 2,
            buyUnitFee: -5,
            stockUnitsId: '${boxUnitsId}',
            price: 50,
            stockBuyUnitFee: -5
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : [];
          return {
            noteIdSameDayBox: notes[0]?.noteId,
            noteIdsSameDayBox: notes.map((row: any) => row.noteId)
          };
        }
      }).setRemark('当日第二单：2箱'),

      new Action({
        name: '发单当日2箱',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIdsSameDayBox}',
          status: 'normal'
        }
      }).setRemark('发当日2箱单'),

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
      }).setRemark('分享当日分组'),

      new DownloadExcelAction({
        name: '下载当日物料一览',
        remark: '当日4瓶+2箱 → 14瓶',
        url: '/app/note/downloadNotes',
        sheetName: '物料一览',
        param: {
          shareDataNo: '${shareDataNo}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(rows: any[]) {
          const beef = (rows ?? []).find((row: any) => row['名称'] === '牛肉');
          CheckUtil.expectEqual(beef != null, true, `物料一览缺少牛肉行: ${JSON.stringify(rows)}`);
          CheckUtil.expectEqual(
            beef['订货数量'],
            '14瓶',
            `当日物料一览订货数量应为14瓶，实际=${beef['订货数量']}`
          );
        }
      }).setRemark('校验当日物料一览=14瓶')
    ];
  }
}

/**
 * 场景2：前天用瓶订、昨天用箱订。
 * - 单笔下载：前天 sheet 订货数量=3瓶；昨天 sheet 订货数量=1箱
 * - 跨日汇总（begin~end）：物料一览=8瓶（或等价1.6箱）
 */
class SceneCrossDayMix extends TestCase {
  constructor() {
    super({ remark: '场景2：前天瓶 + 昨天箱，分日/跨日下载校验' });
  }

  getName(): string {
    return '场景2-跨日混单位';
  }

  protected buildActions(): BaseTest[] {
    const dayBeforeYesterday = dayStr(2);
    const yesterday = dayStr(1);
    const dayBeforeYesterdayTime = dayTime(2);
    const yesterdayTime = dayTime(1);

    return [
      new Action({
        name: '下单3瓶(将改到前天)',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商2}',
            cnt: 3,
            buyUnitFee: 1,
            stockUnitsId: '${bottleUnitsId}',
            price: 10,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : [];
          const note = notes[0] ?? {};
          let title = note.title ?? '';
          title = String(title).replace(/\[/g, '(').replace(/\]/g, ')');
          return {
            noteIdDayBeforeBottle: note.noteId,
            noteIdsDayBeforeBottle: notes.map((row: any) => row.noteId),
            noteTitleDayBeforeBottle: title
          };
        }
      }).setRemark('创建3瓶单（随后入库再改到前天）'),

      new Action({
        name: '发单3瓶',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIdsDayBeforeBottle}',
          status: 'normal'
        }
      }).setRemark('发3瓶单'),

      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal'
      }).setRemark('待入库分组（含当日未入库单）'),

      new BatchProcessNote({
        action: 'instock'
      }).setRemark('先入库（含3瓶单）'),

      new Action({
        name: '改期到前天',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${noteIdDayBeforeBottle}',
          sysAddTime: dayBeforeYesterdayTime,
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }).setRemark(`入库后再改到前天 ${dayBeforeYesterday}`),

      new Action({
        name: '下单1箱(将改到昨天)',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商2}',
            cnt: 1,
            buyUnitFee: -5,
            stockUnitsId: '${boxUnitsId}',
            price: 50,
            stockBuyUnitFee: -5
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : [];
          const note = notes[0] ?? {};
          let title = note.title ?? '';
          title = String(title).replace(/\[/g, '(').replace(/\]/g, ')');
          return {
            noteIdYesterdayBox: note.noteId,
            noteIdsYesterdayBox: notes.map((row: any) => row.noteId),
            noteTitleYesterdayBox: title
          };
        }
      }).setRemark('创建1箱单（随后入库再改到昨天）'),

      new Action({
        name: '发单1箱',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIdsYesterdayBox}',
          status: 'normal'
        }
      }).setRemark('发1箱单'),

      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal',
        len: 1,
        noteCnt: 1
      }).setRemark('待入库：仅1箱单'),

      new BatchProcessNote({
        action: 'instock'
      }).setRemark('先入库1箱单'),

      new Action({
        name: '改期到昨天',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${noteIdYesterdayBox}',
          sysAddTime: yesterdayTime,
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }).setRemark(`入库后再改到昨天 ${yesterday}`),

      // 若 createNote 未带回 title，从 listNote 补
      new Action({
        name: '查前天订单title',
        url: '/app/note/listNote',
        method: 'POST',
        param: {
          noteId: '${noteIdDayBeforeBottle}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          const content = result.result?.content ?? [];
          const note = content[0] ?? {};
          let title = note.title ?? '';
          title = String(title).replace(/\[/g, '(').replace(/\]/g, ')');
          if (!title) {
            throw new Error(`前天订单缺少 title: ${JSON.stringify(note)}`);
          }
          return { noteTitleDayBeforeBottle: title };
        }
      }).setRemark('补齐前天订单 sheet 名'),

      new Action({
        name: '查昨天订单title',
        url: '/app/note/listNote',
        method: 'POST',
        param: {
          noteId: '${noteIdYesterdayBox}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          const content = result.result?.content ?? [];
          const note = content[0] ?? {};
          let title = note.title ?? '';
          title = String(title).replace(/\[/g, '(').replace(/\]/g, ')');
          if (!title) {
            throw new Error(`昨天订单缺少 title: ${JSON.stringify(note)}`);
          }
          return { noteTitleYesterdayBox: title };
        }
      }).setRemark('补齐昨天订单 sheet 名'),

      // —— 前天单笔：订货数量 3瓶 ——
      new DownloadExcelAction({
        name: '下载前天订单sheet',
        remark: '前天用瓶订 → 订货数量=3瓶',
        url: '/app/note/downloadNotes',
        sheetName: '${noteTitleDayBeforeBottle}',
        param: {
          noteId: '${noteIdDayBeforeBottle}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(rows: any[]) {
          const beef = (rows ?? []).find((row: any) => row['物料'] === '牛肉');
          CheckUtil.expectEqual(beef != null, true, `前天订单sheet缺少牛肉: ${JSON.stringify(rows)}`);
          CheckUtil.expectEqual(
            beef['订货数量'],
            '3瓶',
            `前天订货数量应为3瓶，实际=${beef['订货数量']}`
          );
        }
      }).setRemark('前天单：3瓶'),

      // —— 昨天单笔：订货数量 1箱 ——
      new DownloadExcelAction({
        name: '下载昨天订单sheet',
        remark: '昨天用箱订 → 订货数量=1箱',
        url: '/app/note/downloadNotes',
        sheetName: '${noteTitleYesterdayBox}',
        param: {
          noteId: '${noteIdYesterdayBox}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(rows: any[]) {
          const beef = (rows ?? []).find((row: any) => row['物料'] === '牛肉');
          CheckUtil.expectEqual(beef != null, true, `昨天订单sheet缺少牛肉: ${JSON.stringify(rows)}`);
          CheckUtil.expectEqual(
            beef['订货数量'],
            '1箱',
            `昨天订货数量应为1箱，实际=${beef['订货数量']}`
          );
        }
      }).setRemark('昨天单：1箱'),

      // —— 跨日汇总：begin=前天 end=昨天 → 3瓶+1箱=8瓶（已入库，status=instocked）——
      new SaveShareData({
        data: {
          group: {
            groupType: 'NoteMonth',
            status: 'instocked',
            begin: dayBeforeYesterday,
            end: yesterday
          },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }).setRemark('分享跨日已入库分组（前天~昨天）'),

      new DownloadExcelAction({
        name: '跨日下载物料一览',
        remark: '前天3瓶+昨天1箱 → 8瓶',
        url: '/app/note/downloadNotes',
        sheetName: '物料一览',
        param: {
          shareDataNo: '${shareDataNo}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(rows: any[]) {
          const beef = (rows ?? []).find((row: any) => row['名称'] === '牛肉');
          CheckUtil.expectEqual(beef != null, true, `跨日物料一览缺少牛肉行: ${JSON.stringify(rows)}`);
          const qty = beef['订货数量'];
          const ok = qty === '8瓶' || qty === '1.6箱';
          CheckUtil.expectEqual(
            ok,
            true,
            `跨日物料一览订货数量应为8瓶或1.6箱，实际=${qty}`
          );
        }
      }).setRemark('跨日物料一览：3瓶+1箱=8瓶')
    ];
  }
}

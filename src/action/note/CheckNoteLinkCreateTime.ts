import { BaseTest, CheckUtil, DateUtil, TestCase, TestRunner } from "testflow";
import Action from "../Action";

interface Opt {
  /** 第一次 listNote 的额外查询条件 */
  query?: any;
  /** 期望 createTime 日期 YYYY-MM-DD */
  expectDay?: string;
  name?: string;
  noteId?: string;
  /** 从 listNote 结果中选取主单 */
  pickNote?: (content: any[]) => any;
  /** 将选中主单的 noteId 写入变量，如 backNoteId */
  saveNoteIdAs?: string;
}

function toDayStr(val: any): string {
  return DateUtil.format(new Date(val));
}

function pickMainNote(content: any[], opt: Opt) {
  if (opt.pickNote) {
    return opt.pickNote(content);
  }
  return content[0];
}

function assertCreateTime(note: any, expectDay?: string) {
  CheckUtil.expectEqual(note != null, true, '未找到订单');
  CheckUtil.expectEqual(note.createTime != null, true, `订单${note.noteId}缺少createTime`);
  const createDay = toDayStr(note.createTime);
  if (expectDay != null) {
    CheckUtil.expectEqual(createDay, expectDay, `订单${note.noteId}的createTime应为${expectDay}，实际${createDay}`);
  }
}

export default class CheckNoteLinkCreateTime extends TestCase {
  private testOpt: Opt;

  constructor(opt: Opt) {
    super();
    this.testOpt = opt;
  }

  getName(): string {
    return this.testOpt.name ?? '检查订单和链接单createTime';
  }

  buildActions(): BaseTest[] {
    const opt = this.testOpt;
    const param: any = { ...(opt.query ?? {}) };
    if (opt.noteId != null) {
      param.noteId = opt.noteId;
    }
    return [
      new Action({
        name: opt.name ? `${opt.name}(主单)` : '查询主单',
        url: '/app/note/listNote',
        param,
      }, {
        buildVariable(result) {
          const content: any[] = result.result.content;
          const note = pickMainNote(content, opt);
          CheckUtil.expectEqual(note != null, true, '未找到订单');
          CheckUtil.expectEqual(note.linkNoteId != null && note.linkNoteId !== 0, true, `订单${note.noteId}缺少链接单`);
          const ret: any = {
            linkNoteId: note.linkNoteId,
            mainNoteCreateTime: note.createTime,
          };
          if (opt.saveNoteIdAs) {
            ret[opt.saveNoteIdAs] = note.noteId;
          }
          return ret;
        },
        check(result) {
          const content: any[] = result.result.content;
          const note = pickMainNote(content, opt);
          assertCreateTime(note, opt.expectDay);
        },
      }),
      new Action({
        name: opt.name ? `${opt.name}(链接单)` : '查询链接单',
        url: '/app/note/listNote',
        param: { noteId: '${linkNoteId}' },
      }, {
        warehouseType: 'supplierWarehouse',
        needRunVariable: {
          key: 'linkNoteId',
        },
        check(result) {
          const content: any[] = result.result.content;
          CheckUtil.expectEqual(content.length > 0, true, '未找到链接单');
          assertCreateTime(content[0], opt.expectDay);
          const variable = TestRunner.get().getVariable();
          if (variable?.mainNoteCreateTime != null) {
            CheckUtil.expectEqual(
              toDayStr(content[0].createTime),
              toDayStr(variable.mainNoteCreateTime),
              `链接单${content[0].noteId}与主单createTime不一致`
            );
          }
        },
      }),
    ];
  }
}

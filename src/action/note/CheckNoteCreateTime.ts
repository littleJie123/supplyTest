import { CheckUtil, DateUtil } from "testflow";
import Action from "../Action";
import IOpt from "../../inf/IOpt";

interface Opt {
  /** 变量引用，默认 ${noteIds} */
  noteIds?: string;
  /** 期望的 createTime 日期 YYYY-MM-DD */
  expectDay?: string;
  /** 校验 createTime 与 sysAddTime 为同一天，新建订单默认 true */
  sameDayAsSysAddTime?: boolean;
}

function toDayStr(val: any): string {
  if (val == null) {
    return '';
  }
  if (val instanceof Date) {
    return DateUtil.format(val);
  }
  return String(val).substring(0, 10);
}

export default class extends Action {
  constructor(opt?: Opt, afterProcess?: IOpt) {
    const noteIds = opt?.noteIds ?? '${noteIds}';
    const sameDayAsSysAddTime = opt?.sameDayAsSysAddTime ?? true;
    super({
      name: '检查订单createTime',
      url: '/free/query',
      param: {
        array: [{
          table: 'note',
          query: {
            noteId: noteIds,
            isDel: 0,
          },
          cols: ['noteId', 'createTime', 'sysAddTime']
        }]
      }
    }, {
      ...afterProcess,
      check(result) {
        const notes: any[] = result.result?.note ?? [];
        CheckUtil.expectEqual(notes.length > 0, true, '未找到订单');
        for (const note of notes) {
          CheckUtil.expectEqual(note.createTime != null, true, `订单${note.noteId}缺少createTime`);
          const createDay = toDayStr(note.createTime);
          if (opt?.expectDay != null) {
            CheckUtil.expectEqual(createDay, opt.expectDay, `订单${note.noteId}的createTime不正确，期望${opt.expectDay}，实际${createDay}`);
          }
          if (sameDayAsSysAddTime) {
            const sysAddDay = toDayStr(note.sysAddTime);
            CheckUtil.expectEqual(createDay, sysAddDay, `订单${note.noteId}的createTime与sysAddTime日期不一致，createTime=${createDay}，sysAddTime=${sysAddDay}`);
          }
        }
      }
    });
  }
}

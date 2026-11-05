import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import QueryAction from "../../action/QueryAction";

/** 断言 listNote 返回的订单号与期望一致（忽略顺序） */
function expectNoteIds(content: any[], ids: any[], label: string) {
  let actual = (content ?? []).map((row: any) => String(row.noteId)).sort()
  let expected = ids.map((id) => String(id)).sort()
  CheckUtil.expectEqual(
    actual.join(','),
    expected.join(','),
    `${label} 订单应为[${expected.join(',')}]，实际=[${actual.join(',')}]`
  )
}

function createNote(name: string, noteVar: string): Action {
  return new Action({
    name: `下单${name}`,
    url: '/app/note/createNote',
    method: 'POST',
    param: {
      warehouseId: '${warehouse.warehouseId}',
      warehouseGroupId: '${warehouse.warehouseGroupId}',
      items: [{
        materialId: '${materialMap.香蕉.materialId}',
        supplierId: '${supplierMap.供应商1}',
        cnt: 1,
        buyUnitFee: 1,
        price: 10,
        stockBuyUnitFee: 1
      }]
    }
  }, {
    buildVariable(result) {
      let noteId = result.result[0].noteId
      return {
        [noteVar]: noteId,
        noteIds: [noteId]
      }
    }
  })
}

function sendNote(name: string): Action {
  return new Action({
    name: `发送${name}`,
    url: '/app/note/sendNote',
    method: 'POST',
    param: {
      noteIds: '${noteIds}',
      status: 'normal',
      warehouseId: '${warehouse.warehouseId}',
      warehouseGroupId: '${warehouse.warehouseGroupId}'
    }
  })
}

function instockNote(name: string, noteVar: string): Action {
  return new Action({
    name: `入库${name}`,
    url: '/app/note/batchProcessNote',
    method: 'POST',
    param: {
      action: 'instock',
      noteIds: [],
      type: 'purcharse',
      warehouseId: '${warehouse.warehouseId}',
      warehouseGroupId: '${warehouse.warehouseGroupId}'
    }
  }, {
    parseHttpParam(param, variable) {
      param.noteIds = [variable[noteVar]]
      return param
    }
  })
}

function setInstockTime(name: string, noteVar: string, day: string): Action {
  return new Action({
    name: `入库时间改为${day}`,
    remark: `${name} 只传 instockTime`,
    url: '/app/note/updateNoteTime',
    method: 'POST',
    param: {
      noteId: `\${${noteVar}}`,
      instockTime: `${day} 00:00:00`,
      warehouseId: '${warehouse.warehouseId}',
      warehouseGroupId: '${warehouse.warehouseGroupId}'
    }
  })
}

/**
 * 已入库单：下单、发送、入库，再把 instockTime 改到指定日。
 */
function instockOnDay(name: string, noteVar: string, day: string): BaseTest[] {
  return [
    createNote(name, noteVar),
    sendNote(name),
    instockNote(name, noteVar),
    setInstockTime(name, noteVar, day)
  ]
}

/**
 * listNote 按入库时间筛选。
 * beginInstockTime：instockTime >= 当天；endInstockTime：instockTime < 次日。
 * 四张已入库单：7/2、7/4、7/5、7/8。另有一张已发送未入库，instockTime 为空，任何入库日条件都不应查出。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: 'listNote 的 beginInstockTime、endInstockTime 按入库日筛选，结束日含当天' })
  }

  getName(): string {
    return '按入库时间查询订单'
  }

  protected buildActions(): BaseTest[] {
    let variable = this.getVariable()
    let query = (name: string, begin: string | null, end: string | null, ids: () => any[], remark: string) => {
      let param: any = {}
      if (begin != null) {
        param.beginInstockTime = begin
      }
      if (end != null) {
        param.endInstockTime = end
      }
      return new QueryAction({
        name,
        url: '/app/note/listNote',
        query: param
      }, {
        check(result) {
          expectNoteIds(result.result.content ?? [], ids(), name)
        }
      }).setRemark(remark)
    }
    return [
      new PreTest({
        remark: '前置：仓库、供应商、香蕉',
        materialsOpts: [{
          name: '香蕉',
          category: '蔬菜',
          unit: '包',
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: 10
          }]
        }]
      }),

      ...instockOnDay('7月2日', 'note0702', '2026-07-02'),
      ...instockOnDay('7月4日', 'note0704', '2026-07-04'),
      ...instockOnDay('7月5日', 'note0705', '2026-07-05'),
      ...instockOnDay('7月8日', 'note0708', '2026-07-08'),

      createNote('未入库', 'noteNormal'),
      sendNote('未入库'),

      query(
        '入库日7月2日',
        '2026-07-02',
        '2026-07-02',
        () => [variable.note0702],
        '起止都是 2026-07-02，只有这一张'
      ),
      query(
        '入库日7月4日',
        '2026-07-04',
        '2026-07-04',
        () => [variable.note0704],
        '不含 7/2、7/5、7/8'
      ),
      query(
        '入库日7月5日',
        '2026-07-05',
        '2026-07-05',
        () => [variable.note0705],
        '起止都是 2026-07-05，只有这一张'
      ),
      query(
        '入库日7月3日为空',
        '2026-07-03',
        '2026-07-03',
        () => [],
        '7/3 没有入库单'
      ),
      query(
        '7月2日到7月4日',
        '2026-07-02',
        '2026-07-04',
        () => [variable.note0702, variable.note0704],
        '含 7/2 和 7/4，不含 7/5、7/8'
      ),
      query(
        '7月4日到7月5日',
        '2026-07-04',
        '2026-07-05',
        () => [variable.note0704, variable.note0705],
        '含 7/4 和 7/5，不含 7/2、7/8'
      ),
      query(
        '7月2日到7月5日',
        '2026-07-02',
        '2026-07-05',
        () => [variable.note0702, variable.note0704, variable.note0705],
        '三张在范围内，7/8 和未入库单不在'
      ),
      query(
        '仅开始日7月5日',
        '2026-07-05',
        null,
        () => [variable.note0705, variable.note0708],
        '只传 beginInstockTime，7/5 及之后有 7/5、7/8'
      ),
      query(
        '仅结束日7月2日',
        null,
        '2026-07-02',
        () => [variable.note0702],
        '只传 endInstockTime，7/2 及之前只有 7/2；未入库单 instockTime 为空，不应查出'
      )
    ]
  }
}

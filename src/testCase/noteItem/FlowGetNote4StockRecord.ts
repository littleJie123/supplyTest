import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";

/**
 * 根据库存流水的 noteItemType + noteItemId 反查单据（见同目录 FlowGetNote4StockRecord.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: 'getNote4StockRecord：noteItem 反查订单，other_item 反查其他消耗' })
  }

  getName(): string {
    return '库存流水反查单据'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new PreTest({
        remark: '初始化餐厅、供应商、物料'
      }),

      new PrepNote(),

      new Action({
        name: '反查订单',
        remark: 'noteItemType=noteItem，期望 type=Note、id=noteId',
        url: '/app/noteItem/getNote4StockRecord',
        param: {
          noteItemType: 'noteItem',
          noteItemId: '${noteItemId}'
        }
      }, {
        check(result) {
          const ret = result?.result
          CheckUtil.expectEqual(ret?.type, 'Note', `订单应返回 type=Note，实际=${JSON.stringify(ret)}`)
          CheckUtil.expectEqual(ret?.id, variable.noteId, `订单应返回 id=noteId(${variable.noteId})，实际=${JSON.stringify(ret)}`)
        }
      }),

      new Action({
        name: '盘点牛肉',
        remark: '牛肉 10 斤 100 元，给后续其他消耗扣库存',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          array: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 10,
            buyUnitFee: 1,
            cost: 100
          }]
        }
      }),

      new PrepOtherUse(),

      new Action({
        name: '反查其他消耗',
        remark: 'noteItemType=other_item，期望 type=OhterUse、id=otherUseId',
        url: '/app/noteItem/getNote4StockRecord',
        param: {
          noteItemType: 'other_item',
          noteItemId: '${otherItemId}'
        }
      }, {
        check(result) {
          const ret = result?.result
          CheckUtil.expectEqual(ret?.type, 'OhterUse', `其他消耗应返回 type=OhterUse，实际=${JSON.stringify(ret)}`)
          CheckUtil.expectEqual(ret?.id, variable.otherUseId, `其他消耗应返回 id=otherUseId(${variable.otherUseId})，实际=${JSON.stringify(ret)}`)
        }
      })
    ]
  }
}

/** createNote → listNoteItem，记下 noteId / noteItemId */
class PrepNote extends TestCase {
  constructor() {
    super({ remark: '下单牛肉并记下 noteId、noteItemId' })
  }

  getName(): string {
    return '下单并记下noteItem'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '下单牛肉',
        remark: 'createNote：牛肉 10 斤，供应商2',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商2}',
            cnt: 10,
            buyUnitFee: 1,
            price: 10,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : []
          return {
            noteId: notes[0]?.noteId,
            noteIds: notes.map((row: any) => row.noteId)
          }
        }
      }),

      new Action({
        name: '查询订单物料',
        remark: 'listNoteItem 记下 noteItemId',
        url: '/app/noteItem/listNoteItem',
        param: {
          noteId: '${noteId}'
        }
      }, {
        buildVariable(result) {
          const content = result.result.content ?? []
          CheckUtil.expectEqual(content.length > 0, true, `订单物料应有数据，实际=${JSON.stringify(content)}`)
          return {
            noteItemId: content[0].noteItemId
          }
        }
      })
    ]
  }
}

/** listOtherType → saveOtherUse → listOtherItem，记下 otherUseId / otherItemId */
class PrepOtherUse extends TestCase {
  constructor() {
    super({ remark: '新增报损消耗并记下 otherUseId、otherItemId' })
  }

  getName(): string {
    return '新增消耗并记下otherItem'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '查询消耗类型',
        remark: '拉取 OtherType，拿到报损 id',
        url: '/app/otherType/listOtherType',
        param: {}
      }, {
        buildVariable(result) {
          const content = result.result.content ?? []
          return {
            otherTypeMap: ArrayUtil.toMapByKey(content, 'name', 'otherTypeId')
          }
        }
      }),

      new Action({
        name: '保存其他消耗',
        remark: '报损：牛肉 1 斤',
        url: '/app/otherUse/saveOtherUse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherTypeMap.报损}',
          remark: '测试反查消耗单',
          otherItems: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 1,
            buyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          return {
            otherUseId: result.result.otherUseId
          }
        }
      }),

      new Action({
        name: '查询消耗物料',
        remark: 'listOtherItem 记下 otherItemId',
        url: '/app/otherItem/listOtherItem',
        param: {
          otherUseId: '${otherUseId}'
        }
      }, {
        buildVariable(result) {
          const content = result.result.content ?? []
          CheckUtil.expectEqual(content.length > 0, true, `消耗物料应有数据，实际=${JSON.stringify(content)}`)
          return {
            otherItemId: content[0].otherItemId
          }
        }
      })
    ]
  }
}

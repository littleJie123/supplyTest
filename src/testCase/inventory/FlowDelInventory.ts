import { ArrayUtil, BaseTest, CheckUtil, DateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import ListMaterial from "../../action/material/ListMaterial";
import ListNoteGroup from "../../action/note/ListNoteGroup";

/**
 * 删除上月末盘点（见同目录 FlowDelInventory.md）。
 *
 * 5/31 盘点 100g@1元 → 6/2 入库 3包@2元 → 6/10 销售 150g。
 * 删盘点前后各打一次 analysyMaterial，用差别验证流水删除与 FIFO 重算。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '删除上月末盘点：入库其他价+销售少于入库，对比两次analysyMaterial' })
  }

  getName(): string {
    return '删除盘点'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        remark: '前置：仓库/供应商/牛肉（初始单位包）',
        materialsOpts: [
          { name: '牛肉', category: '肉类', unit: '包', code: 'MAT_BEEF' }
        ]
      }),

      new Action({
        name: '转化规格:牛肉(1包=100克)',
        remark: 'saveBuyUnit：克+包，1包=100克；盘点/销售用克 fee=100',
        url: '/app/material/saveBuyUnit',
        param: {
          materialId: '${materialMap.牛肉.materialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          supplierUnitsName: '包'
        }
      }),
      new ListMaterial().setRemark('刷新 materialMap'),

      new SetupProductBom(),

      new Action({
        name: '上月末盘点100g',
        remark: '5/31 牛肉 cnt=100, buyUnitFee=100 / 100元，单价1元/g',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-05-31',
          array: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 100,
            buyUnitFee: 100,
            cost: 100
          }]
        }
      }),

      new OrderInstockJune2(),

      new Action({
        name: '6月10日销售15份',
        remark: '红烧牛肉15份 → 牛肉-150g（低于入库300g）',
        url: '/app/salesRecord/importSalesRecord',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          datas: [{
            product: {
              name: '红烧牛肉',
              id: '${product.红烧牛肉}'
            },
            salesRecord: { name: DateUtil.toExcelDateNum(DateUtil.parse('2026-06-10')) },
            cnt: { name: 15 }
          }]
        }
      }),

      new AnalysyBeforeDel(),

      new Action({
        highlight:true,
        name: '删除上月末盘点',
        remark: 'delInventoryByInventoryDay：删除5/31盘点并 recalByBeginStr',
        url: '/app/inventory/delInventoryByInventoryDay',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          inventoryDay: '2026-05-31'
        }
      }),

      new AnalysyAfterDel()
    ]
  }
}

/** 红烧牛肉：BOM 每份 10g(fee100)，理论价 1元/g */
class SetupProductBom extends TestCase {
  constructor() {
    super({ remark: '增加红烧牛肉并设置BOM：10g/份(buyUnitFee=100)，理论价1元/g' })
  }

  getName(): string {
    return '设置餐品BOM'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '增加餐品红烧牛肉',
        remark: 'addProduct',
        url: '/app/product/addProduct',
        param: { name: '红烧牛肉' }
      }, {
        buildVariable(result) {
          return { productId: result.result.productId }
        }
      }),
      new Action({
        name: '保存BOM',
        remark: '每份消耗牛肉10g(fee100)，price=1元/g',
        url: '/app/bom/saveBom',
        param: {
          productId: '${productId}',
          boms: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 10,
            buyUnitFee: 100,
            yieldRate: 1,
            netCnt: 10,
            price: 1,
            stockBuyUnitFee: 100
          }]
        }
      }),
      new Action({
        name: '查询餐品',
        remark: '拿到 productMap',
        url: '/app/product/listProduct',
        param: {}
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content
          return {
            product: ArrayUtil.toMapByKey(content, 'name', 'productId')
          }
        }
      })
    ]
  }
}

/** 6月2日订单入库 3包/600元（2元/g，按包 buyUnitFee=1） */
class OrderInstockJune2 extends TestCase {
  constructor() {
    super({ remark: '6月2日订单入库：牛肉3包(buyUnitFee=1)/600元（2元/g）' })
  }

  getName(): string {
    return '6月2日订单入库'
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote(牛3包)',
        remark: '下单牛肉3包(fee1)，600元，2元/g',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 3,
            buyUnitFee: 1,
            price: 200,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result
          return {
            noteIds: ArrayUtil.toArray(content, 'noteId'),
            note: content[0]
          }
        }
      }),
      new Action({
        name: '发送订单',
        remark: 'sendNote',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal'
      }).setRemark('待入库分组'),
      new Action({
        name: '入库processNote',
        remark: '全量入库',
        url: '/app/note/processNote',
        param: {
          noteId: '${note.noteId}',
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(ret: any, variable: any) {
          let noteItems: any[] = variable.note.noteItems
          ret.noteItems = noteItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            cnt: row.cnt,
            instockCnt: row.cnt,
            price: row.price,
            stockBuyUnitFee: row.stockBuyUnitFee,
            materialId: row.materialId,
            yieldRate: 0
          }))
          return ret
        }
      }),
      new Action({
        name: '修改订单时间为6月2日',
        remark: 'updateNoteTime → 2026-06-02',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${note.noteId}',
          sysAddTime: '2026-06-02 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ]
  }
}

function findBeefRow(result: any, variable: any) {
  let content = result.result?.content ?? []
  let beefId = variable.materialMap?.牛肉?.materialId
  return content.find((r: any) => String(r.materialId) === String(beefId))
}

/**
 * 第一次：有 5/31 期初盘点。
 * 用量口径（sales+inventory，克 fee=100）：
 * - 盘点 +100 → 贡献 -100g/-100元
 * - 销售 150g FIFO：100g@1 + 50g@2 → +150g/+200元
 * - allStock = 50g / 100元（全部分摊到红烧牛肉）
 * BOM 1元/g：theoryCost=150；costByBomPrice=50
 * cost=100；diff=-50；diffByCnt=-100；diffByPrice=50
 */
class AnalysyBeforeDel extends TestCase {
  constructor() {
    super({ remark: '第一次analysyMaterial：有期初，销售FIFO先扣盘点@1再扣入库@2' })
  }

  getName(): string {
    return '删除前analysyMaterial'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new Recal().setRemark('删除前重算'),
      new Action({
        name: '第一次analysyMaterial',
        remark: 'begin=5/31 end=6/30，有期初盘点',
        url: '/app/state/analysyMaterial',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          begin: '2026-05-31',
          end: '2026-06-30'
        }
      }, {
        check(result) {
          let row = findBeefRow(result, variable)
          CheckUtil.expectEqual(row != null, true, '第一次analysyMaterial应有牛肉行')
          CheckUtil.expectEqual(!!row.hasBeginInventory, true, '删除前应有期初盘点')
          CheckUtil.expectEqual(!!row.hasEndInventory, false, '删除前不应有期末盘点')
          CheckUtil.expectEqual(!!row.hasMidInventory, false, '删除前不应有期中盘点')
          CheckUtil.expectEqual(row.cost, 100, '删除前实际成本应为100')
          CheckUtil.expectEqual(row.theoryCost, 150, '删除前理论成本应为150')
          CheckUtil.expectEqual(row.diff, -50, '删除前diff应为-50')
          CheckUtil.expectEqual(row.diffByCnt, -100, '删除前diffByCnt应为-100')
          CheckUtil.expectEqual(row.diffByPrice, 50, '删除前diffByPrice应为50')
        },
        buildVariable(result) {
          return { firstAnalysy: findBeefRow(result, variable) }
        }
      })
    ]
  }
}

/**
 * 第二次：5/31 盘点流水已删，销售改扣入库@2。
 * - 仅销售 +150g/+300元
 * - allStock = 150g / 300元
 * BOM 1元/g：theoryCost=150（销量不变）；costByBomPrice=150
 * cost=300；diff=150；diffByCnt=0；diffByPrice=150
 * 与第一次比：hasBeginInventory true→false，theoryCost 不变，cost 100→300
 */
class AnalysyAfterDel extends TestCase {
  constructor() {
    super({ remark: '第二次analysyMaterial：无期初，销售全部扣入库@2，对比第一次差别' })
  }

  getName(): string {
    return '删除后analysyMaterial'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new Recal().setRemark('删除后重算'),
      new Action({
        name: '第二次analysyMaterial',
        remark: '同样区间，对比第一次：期初消失、销量理论不变、实际成本随FIFO变化',
        url: '/app/state/analysyMaterial',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          begin: '2026-05-31',
          end: '2026-06-30'
        }
      }, {
        check(result) {
          let row = findBeefRow(result, variable)
          CheckUtil.expectEqual(row != null, true, '第二次analysyMaterial应有牛肉行')
          CheckUtil.expectEqual(!!row.hasBeginInventory, false, '删除后不应有期初盘点')
          CheckUtil.expectEqual(!!row.hasEndInventory, false, '删除后不应有期末盘点')
          CheckUtil.expectEqual(!!row.hasMidInventory, false, '删除后不应有期中盘点')
          CheckUtil.expectEqual(row.cost, 300, '删除后实际成本应为300（销售全扣入库@2）')
          CheckUtil.expectEqual(row.theoryCost, 150, '删除后理论成本仍为150（销量不变）')
          CheckUtil.expectEqual(row.diff, 150, '删除后diff应为150')
          CheckUtil.expectEqual(row.diffByCnt, 0, '删除后diffByCnt应为0')
          CheckUtil.expectEqual(row.diffByPrice, 150, '删除后diffByPrice应为150')

          let first = variable.firstAnalysy
          CheckUtil.expectEqual(first != null, true, '应记下第一次analysyMaterial结果')
          CheckUtil.expectEqual(!!first.hasBeginInventory, true, '第一次应有期初，对比用')
          CheckUtil.expectEqual(first.theoryCost, row.theoryCost, '两次theoryCost应相同（销售未删）')
          CheckUtil.expectEqual(first.cost !== row.cost, true, '两次cost应不同（FIFO批次已变）')
        }
      })
    ]
  }
}

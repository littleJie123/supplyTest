import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";

/**
 * 删除指定日盘点后库存应回到入库水平（见同目录 FlowDelInventoryByDay.md）。
 *
 * 7/1 手工入库 10包/1000元 → 7/2 盘成 2包（processSet 按批次 100元/包回填 → 2包/200）
 * → 删 7/2 盘点 → 库存回到 10包/1000。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '7/1手工入库10包→7/2盘成2包→删除盘点后库存回到10包' })
  }

  getName(): string {
    return '删除盘点还原库存'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new PreTest({
        remark: '前置：仓库/供应商/牛肉（初始单位包）',
        materialsOpts: [
          { name: '牛肉', category: '肉类', unit: '包', code: 'MAT_BEEF' }
        ]
      }),

      new Action({
        name: '7月1日手工入库10包',
        remark: 'createHandInstock：cnt=10, buyUnitFee=1, cost=1000（100元/包）',
        url: '/app/note/createHandInstock',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          salesDay: '2026-07-01',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 10,
            buyUnitFee: 1,
            cost: 1000,
            price: 100,
            stockBuyUnitFee: 1
          }]
        }
      }),
      new Recal().setRemark('手工入库后重算'),

      new Action({
        name: '7月2日盘点成2包',
        remark: 'setInventoryByArray：cnt=2, buyUnitFee=1；processSet 忽略输入成本，按入库批次100元/包回填',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-07-02',
          array: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 2,
            buyUnitFee: 1,
            cost: 200
          }]
        }
      }),

      new VerifyStock({
        remark: '盘点后：盘亏8包，剩2包/200元',
        name: '校验盘点后库存',
        cnt: 2,
        buyUnitFee: 1,
        cost: 200,
        variable
      }),

      new Action({
        highlight: true,
        name: '删除7月2日盘点',
        remark: 'delInventoryByInventoryDay：删除7/2盘点并重算',
        url: '/app/inventory/delInventoryByInventoryDay',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          inventoryDay: '2026-07-02'
        }
      }),

      new VerifyStock({
        remark: '删除盘点后：回到7/1手工入库 10包/1000元',
        name: '校验删除盘点后库存',
        cnt: 10,
        buyUnitFee: 1,
        cost: 1000,
        variable
      })
    ]
  }
}

/** Recal + CheckStock + 金额 */
class VerifyStock extends TestCase {
  private opt: {
    remark: string
    name: string
    cnt: number
    buyUnitFee: number
    cost: number
    variable: any
  }

  constructor(opt: VerifyStock['opt']) {
    super({ remark: opt.remark })
    this.opt = opt
  }

  getName(): string {
    return this.opt.name
  }

  protected buildActions(): BaseTest[] {
    const opt = this.opt
    return [
      new Recal().setRemark(`${opt.remark}·重算`),
      new CheckStock({
        array: [{
          materialId: '${materialMap.牛肉.materialId}',
          cnt: opt.cnt,
          buyUnitFee: opt.buyUnitFee
        }]
      }).setRemark(`${opt.remark}·CheckStock`),
      new CheckArray([{
        table: 'stock',
        check(array) {
          let materialId = opt.variable.materialMap?.牛肉?.materialId
          let stock = array.find((row: any) => String(row.materialId) === String(materialId))
          CheckUtil.expectEqual(stock != null, true, `${opt.name}:牛肉库存不存在`)
          CheckUtil.expectEqual(stock.cnt, opt.cnt, `${opt.name}:牛肉数量不对`)
          CheckUtil.expectEqual(stock.cost, opt.cost, `${opt.name}:牛肉金额不对`)
        }
      }]).setRemark(`${opt.remark}·校验金额`)
    ]
  }
}

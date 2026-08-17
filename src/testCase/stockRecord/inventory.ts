import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";

/**
 * 空物料直接盘 0，再盘 1 包 100 元，校验数量和金额（见同目录 inventory.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '空物料直接盘0，再盘1包100元，校验数量和金额' })
  }

  getName(): string {
    return '盘点0再盘1包100元'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
    return [
      new PreTest({
        remark: '前置：仓库/供应商/牛肉（初始单位包）',
        materialsOpts: [
          { name: '牛肉', category: '肉类', unit: '包', code: 'MAT_BEEF_ZERO' }
        ]
      }),

      new Action({
        name: '直接盘成0',
        remark: '牛肉无任何前置流水，直接盘成 0 包 0 元',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          array: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 0,
            buyUnitFee: 1,
            cost: 0
          }]
        }
      }),

      new VerifyStock({
        remark: '校验盘0后：数量0包、金额0',
        name: '校验盘0后库存',
        cnt: 0,
        buyUnitFee: 1,
        cost: 0,
        variable
      }),

      new Action({
        name: '盘成1包100元',
        remark: '同一物料再盘成 1 包 100 元',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          array: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 1,
            buyUnitFee: 1,
            cost: 100
          }]
        }
      }),

      new VerifyStock({
        remark: '校验盘1包后：数量1包、金额100',
        name: '校验盘1包后库存',
        cnt: 1,
        buyUnitFee: 1,
        cost: 100,
        variable
      })
    ]
  }
}

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

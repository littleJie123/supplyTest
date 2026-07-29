import { BaseTest, TestCase } from "testflow";
import PreTest from "./PreTest";
import Action from "../action/Action";
import ListMaterial from "../action/material/ListMaterial";

/**
 * 在 PreTest 基础上准备肉类物料：
 * - 羊肉、猪肉：初始单位「克」
 * - 牛肉：初始单位「包」
 * - 羊肉、牛肉再经 saveBuyUnit 转为 1包=100克（猪肉保持单单位「克」）
 *
 * 注意：saveBuyUnit 不改已有 unitsId，盘点按包时羊肉用 buyUnitFee=-100，牛肉用 buyUnitFee=1。
 */
export default class extends TestCase {
  getName(): string {
    return '初始化肉类规格(羊牛猪)'
  }

  needInScreen(): boolean {
    return false
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        materialsOpts: [
          { name: '羊肉', category: '肉类', unit: '克' },
          { name: '牛肉', category: '肉类', unit: '包' },
          { name: '猪肉', category: '肉类', unit: '克' }
        ]
      }),
      this.buildSaveBuyUnit('羊肉'),
      this.buildSaveBuyUnit('牛肉'),
      new ListMaterial()
    ]
  }

  /**
   * 转化规格为 1包=100克。新 buyUnit 必须包含创建时的老单位。
   */
  private buildSaveBuyUnit(name: string): Action {
    return new Action({
      name: `转化规格:${name}(1包=100克)`,
      url: '/app/material/saveBuyUnit',
      param: {
        materialId: `\${materialMap.${name}.materialId}`,
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        buyUnit: [
          { name: '克', fee: 1 },
          { name: '包', fee: 100, isSupplier: true }
        ],
        supplierUnitsName: '包'
      }
    })
  }
}

import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import Recal from "../../action/Recal";

/**
 * 物料大厅 / 快捷订货：上次盘点改从 stockRecord 查找（FindLastInventoryHat）。
 * 连续两次盘点后，listMaterialByCategory / listMaterial4FastNote 应返回最近一次，而不是上上次。
 */
export default class extends TestCase {
  constructor() {
    super({
      remark: '上次盘点：两次盘点后 listMaterial 应返回最近一次'
    })
  }

  getName(): string {
    return '上次盘点查stockRecord'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new PreTest({
        remark: '前置：仓库/供应商/物料'
      }),

      this.buildInventory({
        remark: '第一次盘点（较早）：羊肉30',
        name: '盘点2026-05-01',
        day: '2026-05-01',
        items: [{ name: '羊肉', cnt: 30, buyUnitFee: 1, cost: 30 }]
      }),
      new Recal().setRemark('第一次盘点后重算'),

      ...this.buildCheckLastInventory({
        label: '第一次盘点后',
        expectCnt: 30,
        variable
      }),

      this.buildInventory({
        remark: '第二次盘点（较近）：羊肉80（覆盖上次，大厅应显示80不是30）',
        name: '盘点2026-07-01',
        day: '2026-07-01',
        items: [{ name: '羊肉', cnt: 80, buyUnitFee: 1, cost: 80 }]
      }),
      new Recal().setRemark('第二次盘点后重算'),

      ...this.buildCheckLastInventory({
        label: '第二次盘点后',
        expectCnt: 80,
        variable
      }),
    ]
  }

  private buildInventory(opt: {
    remark: string
    name: string
    day: string
    items: Array<{ name: string; cnt: number; buyUnitFee: number; cost: number }>
  }): Action {
    return new Action({
      name: opt.name,
      remark: opt.remark,
      url: '/app/inventory/setInventoryByArray',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        bussinessDate: opt.day,
        array: opt.items.map(row => ({
          materialId: `\${materialMap.${row.name}.materialId}`,
          cnt: row.cnt,
          buyUnitFee: row.buyUnitFee,
          cost: row.cost
        }))
      }
    })
  }

  /**
   * 同时校验物料大厅与快捷订货两个列表接口的 lastInventory
   */
  private buildCheckLastInventory(opt: {
    label: string
    expectCnt: number
    variable: any
  }): BaseTest[] {
    return [
      this.buildListCheck({
        label: opt.label,
        name: 'listMaterialByCategory',
        url: '/app/material/listMaterialByCategory',
        expectCnt: opt.expectCnt,
        variable: opt.variable
      }),
      this.buildListCheck({
        label: opt.label,
        name: 'listMaterial4FastNote',
        url: '/app/material/listMaterial4FastNote',
        expectCnt: opt.expectCnt,
        variable: opt.variable
      }),
    ]
  }

  private buildListCheck(opt: {
    label: string
    name: string
    url: string
    expectCnt: number
    variable: any
  }): Action {
    return new Action({
      remark: `${opt.label}：${opt.name} 的 lastInventory.cnt 应为 ${opt.expectCnt}`,
      name: `${opt.label}-${opt.name}`,
      url: opt.url,
      method: 'POST',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        materialId: ['${materialMap.羊肉.materialId}']
      }
    }, {
      check(result) {
        const content = result.result?.content ?? [];
        const yang = content.find((row: any) =>
          String(row.materialId) === String(opt.variable.materialMap?.羊肉?.materialId)
          || row.name === '羊肉'
        );
        CheckUtil.expectEqual(yang != null, true, `${opt.name}未返回羊肉`);
        CheckUtil.expectEqual(
          yang.lastInventory != null,
          true,
          `${opt.name}羊肉缺少 lastInventory`
        );
        CheckUtil.expectEqual(
          yang.lastInventory.cnt,
          opt.expectCnt,
          `${opt.name}羊肉 lastInventory.cnt 应为 ${opt.expectCnt}，实际 ${yang.lastInventory.cnt}`
        );
        CheckUtil.expectEqual(
          yang.lastInventory.userOfModify != null,
          true,
          `${opt.name} lastInventory 应有 userOfModify`
        );
        CheckUtil.expectEqual(
          yang.lastInventory.sysModifyTime != null,
          true,
          `${opt.name} lastInventory 应有 sysModifyTime`
        );
      }
    })
  }
}

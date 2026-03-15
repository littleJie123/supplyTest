import { BaseTest, TestCase } from "testflow";
import Action from "../Action";
import BuildUpdateStock from "./BuildUpdateStock";
import BuildUpdateStockRecord from "./BuildUpdateStockRecord";

interface Opt {
  materialCnt?: number;
  dayCnt?: number
  cntMap?: any
  defVal?: number;
  defCost?: number;
  nameArray?: string[]
}
export default class extends TestCase {
  private opt: Opt
  constructor(opt: Opt) {
    super()
    this.opt = opt;
  }

  getDayCnt() {
    return this.opt.dayCnt ?? 0;
  }
  protected buildActions(): BaseTest[] {
    let actions: BaseTest[] = [
      new Action({
        name: '盘点',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          array: this.buildArray()
        }
      })
    ]
    let dayCnt = this.getDayCnt();
    if (dayCnt >= 1) {
      actions.push(... new BuildUpdateStockRecord({
        dayCnt: dayCnt,
      }).getActions());
    }
    return actions;
  }

  buildArray() {
    let ret: any[] = [];
    let materialCnt = this.opt.materialCnt ?? 5
    let nameArray = this.opt.nameArray
    if (nameArray == null) {
      for (let i = 0; i < materialCnt; i++) {
        let name = '物料' + i;
        ret.push({
          materialId: `\${materialMap.${name}.materialId}`,
          cnt: this.getValue('cntMap', name),
          buyUnitFee: 1,
          cost: this.opt.defCost ?? 10
        })
      }
    } else {
      for (let name of nameArray) {
        ret.push({
          materialId: `\${materialMap.${name}.materialId}`,
          cnt: this.getValue('cntMap', name),
          buyUnitFee: 1,
          cost: this.opt.defCost ?? 10
        })
      }
    }
    return ret;
  }

  private getValue(type: string, name: string, defVal?: any) {
    if (defVal == null) {
      defVal = this.opt.defVal ?? 5;
    }
    let opt = this.opt;
    if (opt == null || opt[type] == null) {
      return defVal;
    }
    let map = opt[type];
    return map[name] ?? defVal;
  }
  getName(): string {
    return '盘点'
  }

}
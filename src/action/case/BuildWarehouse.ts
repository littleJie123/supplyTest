import { ArrayUtil, BaseTest, TestCase } from "testflow";
import ListSupplier from "../supplier/ListSupplier";
import AddSupplier from "../supplier/AddSupplier";
import FindLastUserId from "../user/FindLastUserId";
import GetOpenId from "../user/GetOpenId";
import AddWarehouse from "../warehouse/AddWarehouse";
import Action from "../Action";

interface Opt {
  materialCnt: number;
}

export default class extends TestCase {
  private testOpt: Opt;
  constructor(opt?: Opt) {

    super()
    this.testOpt = opt;
  }
  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new AddSupplier('供应商1'),
      new AddSupplier('供应商2'),
      new ListSupplier(),
      ... this.buildMaterial()
    ]
  }

  private buildMaterial(): BaseTest[] {
    let materialCnt = this.testOpt?.materialCnt ?? 5;
    let ret: BaseTest[] = []
    let materials: any[] = []
    for (let i = 0; i < materialCnt; i++) {
      materials.push({
        name: `物料${i}`,
        stockUnitsId: 18,
        unitsId: 18,
        buyUnitsId: 132,
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      })
    }
    ret.push(new Action({
      name: '批量增加物料',
      param: {
        array: materials,
        table: 'material'
      },
      url: '/free/add'
    }, {
      buildVariable(result) {
        return {
          materialMap: ArrayUtil.toMapByKey(result.result, 'name')
        }
      }
    }))
    return ret;
  }
  getName(): string {
    return '创建品牌与物料'
  }

}
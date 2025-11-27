import { BaseTest, HttpAction, TestCase } from "testflow";
import { WarehouseType } from "../../inf/IOpt";
import Action from "../Action";

interface Opt {
  materialCnt?: number
  warehouseType?: WarehouseType
}

class BuildMaterial extends HttpAction {
  constructor(opt?: Opt) {
    let materialCnt = opt?.materialCnt ?? 5;
    let materials: any[] = []
    let warehouse = 'warehouse'
    if (opt?.warehouseType == 'supplierWarehouse') {
      warehouse = 'supplierWarehouse'
    }
    for (let i = 0; i < materialCnt; i++) {
      materials.push({
        categoryId: '${categoryId}',
        name: '物料' + i,
        stockUnitsId: 18,
        unitsId: 18,
        buyUnitId: 132,
        warehouseGroupId: `\${${warehouse}.warehouseGroupId}`
      })
    }
    super({
      name: `批量增加${materialCnt}个物料`,
      param: {
        array: materials,
        table: 'material'
      },
      url: '/free/add'
    })
  }
}

export default class extends TestCase {
  private testOpt: Opt;
  constructor(opt?: Opt) {
    super();
    this.testOpt = opt;
  }
  getName(): string {
    return '增加物料'
  }

  buildActions(): BaseTest[] {
    let warehouse = this.testOpt?.warehouseType ?? 'warehouse';
    return [
      new Action({
        url: '/free/add',
        name: '增加分类',
        param: {
          array: [{
            name: '分类1',
            warehouseGroupId: `\${${warehouse}.warehouseGroupId}`
          }],
          table: 'category'
        }
      }, {
        buildVariable(result) {
          return {
            categoryId: result.result[0].categoryId
          }
        }
      }),
      new BuildMaterial(this.testOpt)
    ]
  }
}
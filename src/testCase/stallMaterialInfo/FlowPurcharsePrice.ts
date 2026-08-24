import { ArrayUtil, BaseTest, CheckUtil, TestCase } from 'testflow';
import PreTest from '../PreTest';
import Action from '../../action/Action';
import AddPurcharseByMaterials from '../../action/note/AddPurcharseByMaterials';

const SCH_URL = '/app/stallMaterialInfo/schStallMaterialInfo4Purcharse';

/**
 * 订货自定义价格/供应商（见同目录 md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '订货暂存：不传价→多档口最后为准→只改价格或供应商' });
  }

  getName(): string {
    return '订货自定义价格供应商';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest().setRemark('初始化餐厅、供应商1/2、物料'),
      new NoPriceAndSupplier(),
      new CreateStalls(),
      new MultiStallLastWin(),
      new ChangePriceThenSupplier(),
      new ChangeSupplierThenPrice()
    ];
  }
}

/** 不传价格和供应商：两个接口向前兼容，走默认供应商物料价 */
class NoPriceAndSupplier extends TestCase {
  constructor() {
    super({ remark: '牛肉不传价格供应商：批量订货后查询为默认价10、供应商2、money=500' });
  }

  getName(): string {
    return '不传价格供应商';
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new AddPurcharseByMaterials({
        name: '批量订货-牛肉无价格供应商',
        array: [{
          materialId: '${materialMap.牛肉.materialId}',
          cnt: 50,
          buyUnitFee: 1
        }]
      }).setRemark('addPurcharseByMaterials：牛肉 50，不传 price/supplierId'),

      buildSchAction({
        remark: '查询：默认价10、供应商2、money=500，有 supplier.name',
        name: '查询订货-牛肉默认价',
        check(result) {
          const row = expectRow(result, variable, '牛肉', { cnt: 50, buyUnitFee: 1 });
          CheckUtil.expectEqual(row.supplierMaterial?.price, 10, `牛肉默认价应为 10，实际=${row.supplierMaterial?.price}`);
          expectSupplier(row, variable, '供应商2');
          CheckUtil.expectEqual(result?.result?.money, 500, `money 应为 500，实际=${result?.result?.money}`);
        }
      })
    ];
  }
}

/** 新增两个档口并写入 stallMap */
class CreateStalls extends TestCase {
  constructor() {
    super({ remark: '新增档口A、档口B，listStall 写入 stallMap' });
  }

  getName(): string {
    return '创建档口';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        remark: '新增档口A（全部物料）',
        name: '新增档口A',
        url: '/app/stall/addStall',
        param: {
          name: '档口A',
          warehouseId: '${warehouse.warehouseId}',
          isAll: 1
        }
      }),
      new Action({
        remark: '新增档口B（全部物料）',
        name: '新增档口B',
        url: '/app/stall/addStall',
        param: {
          name: '档口B',
          warehouseId: '${warehouse.warehouseId}',
          isAll: 1
        }
      }),
      new Action({
        remark: '查询档口列表，按 name 写入 stallMap',
        name: '查询档口',
        url: '/app/stall/listStall',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          noCnt: 1
        }
      }, {
        buildVariable(result) {
          const content = result?.result?.content ?? [];
          return {
            stallMap: ArrayUtil.toMapByKey(content, 'name')
          };
        }
      })
    ];
  }
}

/** 多档口不同价格/供应商，查询以有效的最后一个为准 */
class MultiStallLastWin extends TestCase {
  constructor() {
    super({ remark: '猪肉档口A价8/供应商1，再档口B价9/供应商2；查询取最后：价9、供应商2' });
  }

  getName(): string {
    return '多档口最后为准';
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new AddPurcharseByMaterials({
        name: '档口A订猪肉',
        array: [{
          materialId: '${materialMap.猪肉.materialId}',
          stallStocks: [{
            stallId: '${stallMap.档口A.stallId}',
            cnt: 10,
            buyUnitFee: 1,
            price: 8,
            stockBuyUnitFee: 1,
            supplierId: '${supplierMap.供应商1}'
          }]
        }]
      }).setRemark('档口A：猪肉 cnt=10，价8，供应商1'),

      new AddPurcharseByMaterials({
        name: '档口B订猪肉',
        array: [{
          materialId: '${materialMap.猪肉.materialId}',
          stallStocks: [{
            stallId: '${stallMap.档口B.stallId}',
            cnt: 20,
            buyUnitFee: 1,
            price: 9,
            stockBuyUnitFee: 1,
            supplierId: '${supplierMap.供应商2}'
          }]
        }]
      }).setRemark('档口B：猪肉 cnt=20，价9，供应商2（后写入，查询以它为准）'),

      buildSchAction({
        remark: '查询猪肉：合计30、价9、供应商2、money=270，不是默认价21',
        name: '查询订货-猪肉最后档口',
        check(result) {
          const row = expectRow(result, variable, '猪肉', { cnt: 30, buyUnitFee: 1 });
          CheckUtil.expectEqual(row.supplierMaterial?.price, 9, `猪肉最后价应为 9，实际=${row.supplierMaterial?.price}`);
          CheckUtil.expectEqual(row.supplierMaterial?.buyUnitFee, 1, `猪肉 buyUnitFee 应为 1`);
          expectSupplier(row, variable, '供应商2');
          CheckUtil.expectEqual(result?.result?.money, 500 + 270, `money 应为 770（牛500+猪270），实际=${result?.result?.money}`);
        }
      })
    ];
  }
}

/** 只改价格再只改供应商：已有价格不覆盖，供应商从 Hat 补后再被更新 */
class ChangePriceThenSupplier extends TestCase {
  constructor() {
    super({ remark: '羊肉先只传价30（供应商走默认1），再只改供应商2（价格保持30）' });
  }

  getName(): string {
    return '只改价格再改供应商';
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new AddPurcharseByMaterials({
        name: '羊肉只传价格',
        array: [{
          materialId: '${materialMap.羊肉.materialId}',
          cnt: 10,
          buyUnitFee: 1,
          price: 30,
          stockBuyUnitFee: 1
        }]
      }).setRemark('羊肉 cnt=10，只传价30，不传供应商'),

      buildSchAction({
        remark: '查询羊肉：价30（非默认21）、供应商1（Hat补全）',
        name: '查询订货-羊肉只改价',
        check(result) {
          const row = expectRow(result, variable, '羊肉', { cnt: 10, buyUnitFee: 1 });
          CheckUtil.expectEqual(row.supplierMaterial?.price, 30, `羊肉价应为 30，实际=${row.supplierMaterial?.price}`);
          CheckUtil.expectEqual(row.supplierMaterial?.buyUnitFee, 1, '羊肉 buyUnitFee 应为 1');
          expectSupplier(row, variable, '供应商1');
        }
      }),

      new AddPurcharseByMaterials({
        name: '羊肉只改供应商',
        array: [{
          materialId: '${materialMap.羊肉.materialId}',
          cnt: 10,
          buyUnitFee: 1,
          supplierId: '${supplierMap.供应商2}'
        }]
      }).setRemark('羊肉只传供应商2，不传价格'),

      buildSchAction({
        remark: '查询羊肉：价仍30、供应商改为2',
        name: '查询订货-羊肉只改供应商',
        check(result) {
          const row = expectRow(result, variable, '羊肉', { cnt: 10, buyUnitFee: 1 });
          CheckUtil.expectEqual(row.supplierMaterial?.price, 30, `羊肉价应保持 30，实际=${row.supplierMaterial?.price}`);
          expectSupplier(row, variable, '供应商2');
        }
      })
    ];
  }
}

/** 只改供应商再只改价格 */
class ChangeSupplierThenPrice extends TestCase {
  constructor() {
    super({ remark: '白菜先只传供应商2（价格走默认21），再只改价18（供应商保持2）' });
  }

  getName(): string {
    return '只改供应商再改价格';
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new AddPurcharseByMaterials({
        name: '白菜只传供应商',
        array: [{
          materialId: '${materialMap.白菜.materialId}',
          cnt: 5,
          buyUnitFee: 1,
          supplierId: '${supplierMap.供应商2}'
        }]
      }).setRemark('白菜 cnt=5，只传供应商2，不传价格'),

      buildSchAction({
        remark: '查询白菜：默认价21、供应商2',
        name: '查询订货-白菜只改供应商',
        check(result) {
          const row = expectRow(result, variable, '白菜', { cnt: 5, buyUnitFee: 1 });
          CheckUtil.expectEqual(row.supplierMaterial?.price, 21, `白菜默认价应为 21，实际=${row.supplierMaterial?.price}`);
          expectSupplier(row, variable, '供应商2');
        }
      }),

      new AddPurcharseByMaterials({
        name: '白菜只改价格',
        array: [{
          materialId: '${materialMap.白菜.materialId}',
          cnt: 5,
          buyUnitFee: 1,
          price: 18,
          stockBuyUnitFee: 1
        }]
      }).setRemark('白菜只传价18，不传供应商'),

      buildSchAction({
        remark: '查询白菜：价18、供应商仍为2',
        name: '查询订货-白菜只改价',
        check(result) {
          const row = expectRow(result, variable, '白菜', { cnt: 5, buyUnitFee: 1 });
          CheckUtil.expectEqual(row.supplierMaterial?.price, 18, `白菜价应为 18，实际=${row.supplierMaterial?.price}`);
          CheckUtil.expectEqual(row.supplierMaterial?.buyUnitFee, 1, '白菜 buyUnitFee 应为 1');
          expectSupplier(row, variable, '供应商2');
        }
      })
    ];
  }
}

function buildSchAction(opt: {
  remark: string;
  name: string;
  check: (result: any) => void;
}): BaseTest {
  return new Action({
    remark: opt.remark,
    name: opt.name,
    url: SCH_URL,
    method: 'POST',
    param: {
      warehouseId: '${warehouse.warehouseId}'
    }
  }, {
    check: opt.check
  });
}

function expectRow(
  result: any,
  variable: any,
  name: string,
  stock: { cnt: number; buyUnitFee: number }
): any {
  const content = result?.result?.content ?? [];
  const materialId = variable.materialMap?.[name]?.materialId;
  const row = content.find((r: any) => r.materialId === materialId);
  CheckUtil.expectEqual(row != null, true, `未找到${name} materialId=${materialId}`);
  CheckUtil.expectEqual(row.stock?.cnt, stock.cnt, `${name} cnt 应为 ${stock.cnt}，实际=${row.stock?.cnt}`);
  CheckUtil.expectEqual(row.stock?.buyUnitFee, stock.buyUnitFee, `${name} buyUnitFee 应为 ${stock.buyUnitFee}`);
  CheckUtil.expectEqual(row.name, name, `${name} 物料名应为 ${name}，实际=${row.name}`);
  CheckUtil.expectEqual(row.supplierMaterial != null, true, `${name} 应有 supplierMaterial`);
  CheckUtil.expectEqual(row.stock?.stallStocks == null, true, `${name} 应无 stallStocks`);
  return row;
}

function expectSupplier(row: any, variable: any, supplierName: string) {
  const expectId = variable.supplierMap?.[supplierName];
  CheckUtil.expectEqual(
    row.supplierMaterial?.supplierId,
    expectId,
    `供应商应为 ${supplierName}(${expectId})，实际=${row.supplierMaterial?.supplierId}`
  );
  CheckUtil.expectEqual(row.supplier != null, true, `应挂 supplier 对象`);
  CheckUtil.expectEqual(row.supplier?.name, supplierName, `supplier.name 应为 ${supplierName}，实际=${row.supplier?.name}`);
  CheckUtil.expectEqual(row.supplier?.supplierId, expectId, `supplier.supplierId 应为 ${expectId}`);
}

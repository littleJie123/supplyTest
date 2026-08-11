import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreTestWithMeat from "../PreTestWithMeat";
import Action from "../../action/Action";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import Recal from "../../action/Recal";

/**
 * 验证四个 state 查询已改走 stockRecord（见同目录 FlowStateQueryByStockRecord.md）。
 *
 * 数据：6/1 盘点期初 600 元 → 7/1 订单入库 600 元 → 区间内无消耗。
 * 注意：历史盘点走 timeServer 异步重算，查询前必须 Recal 刷流水。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: 'state 四查询走 stockRecord：盘点期初→订单入库→校验四个接口金额' });
  }

  getName(): string {
    return 'state查询走stockRecord';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTestWithMeat(),

      new Action({
        name: '6月1日盘点',
        remark: '牛肉2包/羊肉2包/猪肉200g，单价1元/g，期初合计600元',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-06-01',
          array: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              cnt: 2,
              buyUnitFee: 1,
              cost: 200
            },
            {
              materialId: '${materialMap.羊肉.materialId}',
              cnt: 2,
              buyUnitFee: -100,
              cost: 200
            },
            {
              materialId: '${materialMap.猪肉.materialId}',
              cnt: 200,
              buyUnitFee: 1,
              cost: 200
            }
          ]
        }
      }),

      new Recal().setRemark('盘点后重算：刷 stockRecord 的 costOfChange/afterStocks'),

      new OrderInstockJuly1(),

      new Recal().setRemark('改单日期后重算：保证7/1入库流水已处理'),

      new CheckStateMaterial().setRemark('校验 /app/state/stateMaterial'),
      new CheckListStateWarehouse().setRemark('校验 /app/state/listStateWarehouse'),
      new CheckAnalyseCategory().setRemark('校验 /app/state/analyseCategory'),
      new CheckAnalyseSupplier().setRemark('校验 /app/state/analyseSupplier'),
      new CheckStateWarehouse().setRemark('校验 /app/state/stateWarehouse 汇总一致')
    ];
  }
}

/** 7月1日订单：牛肉1包、羊肉1包、猪肉100g，2元/g，入库合计600元 */
class OrderInstockJuly1 extends TestCase {
  constructor() {
    super({ remark: '7月1日订单入库：牛肉1包、羊肉1包、猪肉100g，单价2元/g' });
  }

  getName(): string {
    return '7月1日订单入库';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote',
        remark: '下单：牛1包/羊1包/猪100g，2元/g',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [
            {
              materialId: '${materialMap.牛肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 1,
              buyUnitFee: 1,
              price: 200,
              stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.羊肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 1,
              buyUnitFee: -100,
              price: 2,
              stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.猪肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 100,
              buyUnitFee: 1,
              price: 2,
              stockBuyUnitFee: 1
            }
          ]
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result;
          return {
            noteIds: ArrayUtil.toArray(content, 'noteId'),
            note: content[0]
          };
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
      }),

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
          let noteItems: any[] = variable.note.noteItems;
          ret.noteItems = noteItems.map(row => ({
            noteItemId: row.noteItemId,
            cnt: row.cnt,
            instockCnt: row.cnt,
            price: row.price,
            stockBuyUnitFee: row.stockBuyUnitFee,
            materialId: row.materialId,
            yieldRate: 0
          }));
          return ret;
        }
      }),

      new Action({
        name: '修改订单时间为7月1日',
        remark: 'updateNoteTime 到 2026-07-01',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${note.noteId}',
          sysAddTime: '2026-07-01 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ];
  }
}

class CheckStateMaterial extends Action {
  constructor() {
    super({
      name: 'stateMaterial',
      remark: '物料维度：各物料期初200、入库200、耗用0、期末400',
      url: '/app/state/stateMaterial',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        begin: '2026-07-01',
        end: '2026-07-31'
      }
    }, {
      check(result) {
        let content: any[] = result.result.content;
        CheckUtil.expectEqual(content.length >= 3, true, `应至少有3个物料,实际${content?.length}`);
        for (let name of ['牛肉', '羊肉', '猪肉']) {
          let row = content.find(r => r.name === name);
          CheckUtil.expectEqual(row != null, true, `缺少物料${name}, content=${JSON.stringify(content.map(r => ({ name: r.name, openingAmount: r.openingAmount, instockAmount: r.instockAmount, endAmount: r.endAmount })))}`);
          CheckUtil.expectEqual(Number(row.openingAmount), 200, `${name}期初金额实际=${row.openingAmount}`);
          CheckUtil.expectEqual(Number(row.instockAmount), 200, `${name}入库金额实际=${row.instockAmount}`);
          CheckUtil.expectEqual(Number(row.amount), 0, `${name}耗用金额实际=${row.amount}`);
          CheckUtil.expectEqual(Number(row.endAmount), 400, `${name}期末金额实际=${row.endAmount}`);
        }
      }
    });
  }
}

class CheckListStateWarehouse extends Action {
  constructor() {
    super({
      name: 'listStateWarehouse',
      remark: '按日：7/1 期初600、入库600、耗用0、期末1200',
      url: '/app/state/listStateWarehouse',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        begin: '2026-07-01',
        end: '2026-07-31'
      }
    }, {
      check(result) {
        let content: any[] = result.result.content;
        CheckUtil.expectEqual(content.length >= 1, true, '应有按日汇总');
        let day = content.find(r => r.day === '2026-07-01' || r.date === '2026-07-01');
        CheckUtil.expectEqual(day != null, true, '应有2026-07-01行');
        CheckUtil.expectEqual(day.openingAmount, 600, '日汇总期初');
        CheckUtil.expectEqual(day.instockAmount, 600, '日汇总入库');
        CheckUtil.expectEqual(day.amount, 0, '日汇总耗用amount');
        CheckUtil.expectEqual(day.endAmount, 1200, '日汇总期末');
      }
    });
  }
}

class CheckAnalyseCategory extends Action {
  constructor() {
    super({
      name: 'analyseCategory',
      remark: '按分类肉类：期初600、入库600、耗用0、期末1200',
      url: '/app/state/analyseCategory',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        begin: '2026-07-01',
        end: '2026-07-31'
      }
    }, {
      check(result) {
        let content: any[] = result.result.content;
        let meat = content.find(r => r.name === '肉类');
        CheckUtil.expectEqual(meat != null, true, '应有肉类分类');
        CheckUtil.expectEqual(meat.openingAmount, 600, '分类期初');
        CheckUtil.expectEqual(meat.instockAmount, 600, '分类入库');
        CheckUtil.expectEqual(meat.useAmount, 0, '分类耗用');
        CheckUtil.expectEqual(meat.endAmount, 1200, '分类期末');
      }
    });
  }
}

class CheckAnalyseSupplier extends Action {
  constructor() {
    super({
      name: 'analyseSupplier',
      remark: '供应商1入库600；仅期初的门店自操作不返回',
      url: '/app/state/analyseSupplier',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        begin: '2026-07-01',
        end: '2026-07-31'
      }
    }, {
      check(result) {
        let content: any[] = result.result.content;
        let supplierRow = content.find(r => r.name === '供应商1');
        CheckUtil.expectEqual(supplierRow != null, true, '应有供应商1');
        CheckUtil.expectEqual(supplierRow.instockAmount, 600, '供应商1入库');
        CheckUtil.expectEqual(supplierRow.useAmount, 0, '供应商1耗用');

        // 盘点期初落在「门店自操作」，但接口只返回有入库/退货的维度，故不应出现
        let selfRow = content.find(r => r.name === '门店自操作');
        CheckUtil.expectEqual(selfRow == null, true, '仅期初的门店自操作不应出现');
        let instockSum = content.reduce((s, r) => s + Number(r.instockAmount ?? 0), 0);
        CheckUtil.expectEqual(instockSum, 600, '供应商维度入库合计');
      }
    });
  }
}

class CheckStateWarehouse extends Action {
  constructor() {
    super({
      name: 'stateWarehouse',
      remark: '仓库汇总：期初600、入库600、耗用0、期末1200',
      url: '/app/state/stateWarehouse',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}',
        begin: '2026-07-01',
        end: '2026-07-31'
      }
    }, {
      check(result) {
        let info = result.result.result;
        CheckUtil.expectEqual(info.openingAmount, 600, '仓库期初');
        CheckUtil.expectEqual(info.instockAmount, 600, '仓库入库');
        CheckUtil.expectEqual(info.amount, 0, '仓库耗用');
        CheckUtil.expectEqual(info.endAmount, 1200, '仓库期末');
      }
    });
  }
}

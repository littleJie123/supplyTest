import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreTestWithMeat from "../PreTestWithMeat";
import Action from "../../action/Action";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import QueryAction from "../../action/QueryAction";
import Recal from "../../action/Recal";

/**
 * analyseSupplier / analyseCategory 过滤：期间有入库或退货才返回（见同目录 FlowAnalyseInstockFilter.md）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: 'analyseSupplier/Category：仅期初不展示；入库又全退仍展示' });
  }

  getName(): string {
    return 'analyse入库退货过滤';
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

      new Recal().setRemark('盘点后重算'),

      new OrderInstockJuly1(),

      new Recal().setRemark('订单改期后重算'),

      new CheckAfterInstock().setRemark('入库后：有供应商1/肉类；无仅期初的门店自操作'),

      new BackAllJuly15(),

      new Recal().setRemark('退货改期后重算'),

      new CheckAfterFullBack().setRemark('全退后：供应商1/肉类仍在（入库与退货金额均非0）')
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

/** 从 7/1 订单全量退货，业务日改到 7/15 */
class BackAllJuly15 extends TestCase {
  constructor() {
    super({ remark: '7月15日全量退货：退回订单等量物料' });
  }

  getName(): string {
    return '7月15日全量退货';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '查询订单明细',
        remark: '取 noteItem 作退货源',
        url: '/app/noteItem/listNoteItem',
        param: {
          noteId: '${note.noteId}'
        }
      }, {
        buildVariable(result) {
          return { backSrcItems: result.result.content };
        }
      }),

      new Action({
        name: '创建退货单',
        remark: '退：牛肉1包/羊肉1包/猪肉100g',
        url: '/app/noteBack/createNoteBack',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(ret: any, variable: any) {
          let cntMap = {
            [variable.materialMap.牛肉.materialId]: 1,
            [variable.materialMap.羊肉.materialId]: 1,
            [variable.materialMap.猪肉.materialId]: 100
          };
          ret.items = variable.backSrcItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            stockUnitsId: row.stockUnitsId,
            cnt: cntMap[row.materialId],
            buyUnitFee: row.buyUnitFee ?? row.instock?.buyUnitFee ?? row.purcharse?.buyUnitFee,
            price: row.price ?? row.supplierMaterial?.price,
            supplierId: row.supplierId,
            materialId: row.materialId,
            stockBuyUnitFee: row.stockBuyUnitFee ?? row.supplierMaterial?.buyUnitFee
          }));
          return ret;
        }
      }),

      new QueryAction({
        name: '查询退货单',
        url: '/app/note/listNote',
        query: {
          status: 'instocked',
          type: 'back'
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content;
          return { backNoteId: content[0].noteId };
        }
      }),

      new Action({
        name: '修改退货单时间为7月15日',
        remark: 'updateNoteTime：退货业务日改到 2026-07-15',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${backNoteId}',
          sysAddTime: '2026-07-15 00:00:00',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      })
    ];
  }
}

class CheckAfterInstock extends TestCase {
  constructor() {
    super({ remark: '校验入库后 analyseSupplier / analyseCategory 过滤' });
  }

  getName(): string {
    return '校验入库后过滤';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'analyseSupplier',
        remark: '有供应商1入库600；无仅期初的门店自操作',
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
          assertHasInstockOrBack(content, 'analyseSupplier入库后');

          let supplierRow = content.find(r => r.name === '供应商1');
          CheckUtil.expectEqual(supplierRow != null, true, '应有供应商1');
          CheckUtil.expectEqual(Number(supplierRow.instockAmount), 600, `供应商1入库实际=${supplierRow.instockAmount}`);

          let selfRow = content.find(r => r.name === '门店自操作');
          CheckUtil.expectEqual(selfRow == null, true, '仅期初的门店自操作不应出现');
        }
      }),

      new Action({
        name: 'analyseCategory',
        remark: '有肉类入库600；每行须有入库或退货金额',
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
          assertHasInstockOrBack(content, 'analyseCategory入库后');

          let meat = content.find(r => r.name === '肉类');
          CheckUtil.expectEqual(meat != null, true, '应有肉类分类');
          CheckUtil.expectEqual(Number(meat.instockAmount), 600, `分类入库实际=${meat.instockAmount}`);
        }
      })
    ];
  }
}

class CheckAfterFullBack extends TestCase {
  constructor() {
    super({ remark: '校验全退后 analyseSupplier / analyseCategory 仍保留有入库退货的维度' });
  }

  getName(): string {
    return '校验全退后仍展示';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'analyseSupplier全退后',
        remark: '供应商1因入库仍在；退货金额按FIFO落在最旧批次（门店自操作）',
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
          assertHasInstockOrBack(content, 'analyseSupplier全退后');

          // 全退后仍保留：有过入库的供应商1（证明不能只按净额过滤）
          let supplierRow = content.find(r => r.name === '供应商1');
          CheckUtil.expectEqual(supplierRow != null, true, '全退后仍应有供应商1');
          CheckUtil.expectEqual(Number(supplierRow.instockAmount) != 0, true,
            `供应商1入库金额应非0，实际=${supplierRow.instockAmount}`);

          // 退货扣 FIFO 最旧批次（6/1盘点 supplierId=0），且退货流水顶层常无供应商
          // → backAmount 落在「门店自操作」，不会记在供应商1
          let backSum = content.reduce((s, r) => s + Number(r.backAmount ?? 0), 0);
          CheckUtil.expectEqual(backSum != 0, true, `全退后供应商维度退货合计应非0，实际=${backSum}`);
          let selfRow = content.find(r => r.name === '门店自操作');
          CheckUtil.expectEqual(selfRow != null, true, '全退后应出现门店自操作（FIFO退货）');
          CheckUtil.expectEqual(Number(selfRow.backAmount) != 0, true,
            `门店自操作退货金额应非0，实际=${selfRow?.backAmount}`);
        }
      }),

      new Action({
        name: 'analyseCategory全退后',
        remark: '肉类仍在，入库与退货金额均非0',
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
          assertHasInstockOrBack(content, 'analyseCategory全退后');

          let meat = content.find(r => r.name === '肉类');
          CheckUtil.expectEqual(meat != null, true, '全退后仍应有肉类');
          CheckUtil.expectEqual(Number(meat.instockAmount) != 0, true,
            `肉类入库金额应非0，实际=${meat.instockAmount}`);
          CheckUtil.expectEqual(Number(meat.backAmount) != 0, true,
            `肉类退货金额应非0，实际=${meat.backAmount}`);
        }
      })
    ];
  }
}

function assertHasInstockOrBack(content: any[], label: string) {
  CheckUtil.expectEqual(Array.isArray(content) && content.length > 0, true, `${label}应有数据`);
  for (let row of content) {
    let ok = (row.instockAmount ?? 0) != 0
      || (row.backAmount ?? 0) != 0
      || (row.handInstockAmount ?? 0) != 0;
    CheckUtil.expectEqual(ok, true,
      `${label}行「${row.name}」应有入库/退货金额，实际=${JSON.stringify({
        instockAmount: row.instockAmount,
        backAmount: row.backAmount,
        handInstockAmount: row.handInstockAmount
      })}`);
  }
}

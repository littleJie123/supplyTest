import { ArrayUtil, BaseTest, CheckUtil, HttpAction, SetVariable, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import LoginAdmin from "../../action/adminUser/LoginAdmin";
import SubmitCopyDatas from "../../action/copyDatas/SubmitCopyDatas";
import ListNoteGroup from "../../action/note/ListNoteGroup";

const COPY_TABLES = [
  'category',
  'material',
  'supplier',
  'supplierMaterial',
  'stall',
  'stallMaterialInfo',
  'otherType',
  'otherUse',
  'otherItem',
  'product',
  'bom',
  'salesRecord',
  'note',
  'noteItem',
  'inventory',
  'stock',
  'stockRecord'
];

const MATERIAL_NAMES = ['猪肉', '羊肉', '牛肉', '鸡蛋', '白菜'];

/**
 * 把源仓库的物料/餐品/BOM/销售/订单/盘点复制到目标仓，再用 list 接口校验。
 * 见同目录 FlowCopyDatas.md。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '复制数据：源仓造物料供应商档口餐品BOM销售订单盘点其他消耗→同步→list接口校验' });
  }

  getName(): string {
    return '复制数据';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        remark: '创建源仓库、分类、物料'
      }),
      new BuildSrcData(),
      new AddWarehouse({
        name: '复制目标仓',
        variableType: 'warehouse2'
      }).setRemark('新建另一个品牌的目标仓库'),
      new SaveUserToken(),
      new SetVariable({
        name: 'copyNo',
        remark: '生成本次复制的 copyNo',
        variable: {
          copyNo: 'copy_' + Date.now()
        }
      }),
      new LoginAdmin().setRemark('管理员登录，后续走运营平台接口'),
      new HttpAction({
        name: '拉取同步表',
        remark: 'getCopyTables，校验返回的表列表',
        url: '/admin/copyDatas/getCopyTables',
        param: {}
      }, {
        check(result) {
          CheckUtil.expectEqual(
            JSON.stringify(result.result.array),
            JSON.stringify(COPY_TABLES),
            '同步表列表不正确'
          );
        }
      }),
      new CopyAllTables(),
      new VerifyByListApi()
    ];
  }
}

/** 源仓：餐品+BOM、订单入库、盘点、销售 */
class BuildSrcData extends TestCase {
  constructor() {
    super({ remark: '源仓准备餐品BOM、档口、订单、盘点、销售、其他消耗' });
  }

  getName(): string {
    return '准备源仓业务数据';
  }

  protected buildActions(): BaseTest[] {
    return [
      new SetupProductBom(),
      new Action({
        name: '新增档口A',
        remark: '源仓增加档口A，供复制后 listStall 校验',
        url: '/app/stall/addStall',
        param: {
          name: '档口A',
          warehouseId: '${warehouse.warehouseId}',
          isAll: 1
        }
      }),
      new CreateAndInstockNote(),
      new Action({
        name: '源仓库盘点牛肉',
        remark: '盘点牛肉 10，产生 inventory',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-08-01',
          array: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 10,
            buyUnitFee: 1,
            cost: 100
          }]
        }
      }),
      new Action({
        name: '增加销售记录',
        remark: '红烧牛肉销售 1 份，日期 2026-08-02',
        url: '/app/salesRecord/addSalesRecord',
        param: {
          productId: '${product.红烧牛肉}',
          cnt: 1,
          salesDate: '2026-08-02',
          warehouseId: '${warehouse.warehouseId}'
        }
      }),
      new AddOtherUse()
    ];
  }
}

/** listOtherType → saveOtherUse 报损牛肉 1 */
class AddOtherUse extends TestCase {
  constructor() {
    super({ remark: '报损牛肉 1，产生 otherType/otherUse/otherItem' });
  }

  getName(): string {
    return '源仓其他消耗';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '查询消耗类型',
        remark: 'listOtherType，拿到报损 id',
        url: '/app/otherType/listOtherType',
        param: {}
      }, {
        buildVariable(result) {
          const content = result.result.content ?? [];
          return {
            otherTypeMap: ArrayUtil.toMapByKey(content, 'name', 'otherTypeId')
          };
        }
      }),
      new Action({
        name: '保存其他消耗',
        remark: '报损：牛肉 1，日期 2026-08-03',
        url: '/app/otherUse/saveOtherUse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherTypeMap.报损}',
          remark: '复制数据报损',
          createTime: '2026-08-03',
          otherItems: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 1,
            buyUnitFee: 1
          }]
        }
      })
    ];
  }
}

class SetupProductBom extends TestCase {
  constructor() {
    super({ remark: '增加餐品红烧牛肉，BOM 每份牛肉 1（buyUnitFee=1）' });
  }

  getName(): string {
    return '设置餐品BOM';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '增加餐品红烧牛肉',
        remark: 'addProduct',
        url: '/app/product/addProduct',
        param: { name: '红烧牛肉' }
      }, {
        buildVariable(result) {
          return { productId: result.result.productId };
        }
      }),
      new Action({
        name: '保存BOM',
        remark: '每份消耗牛肉1，price=10',
        url: '/app/bom/saveBom',
        param: {
          productId: '${productId}',
          boms: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 1,
            buyUnitFee: 1,
            yieldRate: 1,
            netCnt: 1,
            price: 10,
            stockBuyUnitFee: 1
          }]
        }
      }),
      new Action({
        name: '查询餐品',
        remark: '拿到 productMap',
        url: '/app/product/listProduct',
        param: {}
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content;
          return {
            product: ArrayUtil.toMapByKey(content, 'name', 'productId')
          };
        }
      })
    ];
  }
}

class CreateAndInstockNote extends TestCase {
  constructor() {
    super({ remark: '下单牛肉 2 并入库' });
  }

  getName(): string {
    return '源仓订单入库';
  }

  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote(牛2)',
        remark: '下单牛肉 2，单价 10',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${materialMap.牛肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 2,
            buyUnitFee: 1,
            price: 10,
            stockBuyUnitFee: 1
          }]
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
        remark: 'sendNote，状态 normal',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal'
      }).setRemark('待入库分组'),
      new Action({
        name: '入库processNote',
        remark: '按订单明细全量入库',
        url: '/app/note/processNote',
        param: {
          noteId: '${note.noteId}',
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(ret: any, variable: any) {
          let noteItems: any[] = variable.note.noteItems;
          ret.noteItems = noteItems.map((row: any) => ({
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
      })
    ];
  }
}

class CopyAllTables extends TestCase {
  constructor() {
    super({ remark: '按表循环调用 submitCopyDatas，直到每张表 isFinish' });
  }

  getName(): string {
    return '同步所有表';
  }

  protected buildActions(): BaseTest[] {
    return COPY_TABLES.map(tableName => new SubmitCopyDatas(tableName));
  }
}

class SaveUserToken extends BaseTest {
  constructor() {
    super();
    this.remark = '记下用户 token，复制完切回目标仓';
  }

  getName(): string {
    return '保存用户token';
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    return {
      userToken: this.getVariable().token
    };
  }
}

class RestoreUserToken extends BaseTest {
  constructor() {
    super();
    this.remark = '恢复用户 token，准备切到目标仓';
  }

  getName(): string {
    return '恢复用户token';
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    return {
      token: this.getVariable().userToken
    };
  }
}

/** 切到目标仓后用 list 接口校验 */
class VerifyByListApi extends TestCase {
  constructor() {
    super({ remark: '切到目标仓，用 list 接口校验，并核对 stockRecord.noteItemId' });
  }

  getName(): string {
    return 'list接口校验目标仓';
  }

  protected buildActions(): BaseTest[] {
    return [
      new RestoreUserToken(),
      new Action({
        name: '切换到目标仓库',
        remark: 'changeWarehouse 到 warehouse2',
        url: '/app/warehouseGroup/changeWarehouse',
        param: {
          warehouse: {
            warehouseGroupId: '${warehouse2.warehouseGroupId}',
            warehouseId: '${warehouse2.warehouseId}'
          },
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          return {
            token: result.result?.token.token
          };
        }
      }),
      new Action({
        name: 'listsupplier',
        remark: '目标仓应有供应商1、供应商2',
        url: '/app/supplier/listsupplier',
        param: {
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          for (let name of ['供应商1', '供应商2']) {
            CheckUtil.expectEqual(
              content.some(row => row.name === name),
              true,
              `目标仓listsupplier缺少${name}`
            );
          }
        },
        buildVariable(result) {
          let content: any[] = result.result.content ?? [];
          return {
            targetSupplier: ArrayUtil.toMapByKey(content, 'name', 'supplierId')
          };
        }
      }),
      new Action({
        name: 'listSupplierMaterial4Supplier',
        remark: '目标仓供应商2应有物料报价',
        url: '/app/supplierMaterial/listSupplierMaterial4Supplier',
        param: {
          supplierId: '${targetSupplier.供应商2}',
          warehouseId: '${warehouse2.warehouseId}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(content.length >= 1, true, '目标仓listSupplierMaterial4Supplier应有物料报价');
        }
      }),
      new Action({
        name: 'listStall',
        remark: '目标仓应有档口A',
        url: '/app/stall/listStall',
        param: {
          warehouseId: '${warehouse2.warehouseId}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}',
          noCnt: 1
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(
            content.some(row => row.name === '档口A'),
            true,
            '目标仓listStall缺少档口A'
          );
        }
      }),
      new Action({
        name: 'listMaterialByCategory',
        remark: '目标仓应有猪肉/羊肉/牛肉/鸡蛋/白菜',
        url: '/app/material/listMaterialByCategory',
        param: {
          warehouseId: '${warehouse2.warehouseId}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          for (let name of MATERIAL_NAMES) {
            CheckUtil.expectEqual(
              content.some(row => row.name === name),
              true,
              `目标仓listMaterial缺少${name}`
            );
          }
        },
        buildVariable(result) {
          let content: any[] = result.result.content ?? [];
          return {
            targetMaterial: ArrayUtil.toMapByKey(content, 'name', 'materialId')
          };
        }
      }),
      new Action({
        name: 'listProduct',
        remark: '目标仓应有餐品红烧牛肉',
        url: '/app/product/listProduct',
        param: {
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(
            content.some(row => row.name === '红烧牛肉'),
            true,
            '目标仓listProduct缺少红烧牛肉'
          );
        },
        buildVariable(result) {
          let content: any[] = result.result.content ?? [];
          return {
            targetProduct: ArrayUtil.toMapByKey(content, 'name', 'productId')
          };
        }
      }),
      new Action({
        name: 'listBom',
        remark: '红烧牛肉 BOM 应为牛肉 cnt=1',
        url: '/app/bom/listBom',
        param: {
          productId: '${targetProduct.红烧牛肉}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 1, `目标仓listBom条数应为1，实际${content.length}`);
          CheckUtil.expectEqual(content[0].name, '牛肉', `BOM物料应为牛肉，实际${content[0].name}`);
          CheckUtil.expectEqual(content[0].cnt, 1, `BOM数量应为1，实际${content[0].cnt}`);
        }
      }),
      new Action({
        name: 'listSalesRecord',
        remark: '目标仓应有红烧牛肉销售 1 份',
        url: '/app/salesRecord/listSalesRecord',
        param: {
          warehouseId: '${warehouse2.warehouseId}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}',
          salesDate: '2026-08-02'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 1, `目标仓销售记录应为1条，实际${content.length}`);
          CheckUtil.expectEqual(content[0].product?.name, '红烧牛肉', '销售餐品应为红烧牛肉');
          CheckUtil.expectEqual(content[0].cnt, 1, `销售数量应为1，实际${content[0].cnt}`);
        }
      }),
      new Action({
        name: 'listNote',
        remark: '目标仓应有复制过来的订单',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse2.warehouseId}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(content.length >= 1, true, '目标仓listNote应至少有1张订单');
        },
        buildVariable(result) {
          let content: any[] = result.result.content ?? [];
          return {
            targetNoteId: content[0]?.noteId
          };
        }
      }),
      new Action({
        name: 'listNoteItem',
        remark: '目标仓订单明细应为牛肉数量 2',
        url: '/app/noteItem/listNoteItem',
        param: {
          noteId: '${targetNoteId}',
          warehouseId: '${warehouse2.warehouseId}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          let beef = content.find(row => row.name === '牛肉');
          CheckUtil.expectEqual(beef != null, true, '目标仓listNoteItem缺少牛肉');
          CheckUtil.expectEqual(beef.purcharse?.cnt, 2, `牛肉采购数量应为2，实际${beef.purcharse?.cnt}`);
        },
        buildVariable(result) {
          let content: any[] = result.result.content ?? [];
          let beef = content.find(row => row.name === '牛肉');
          return {
            targetNoteItemId: beef?.noteItemId
          };
        }
      }),
      new Action({
        name: 'listInventory',
        remark: '目标仓盘点牛肉数量应为 10',
        url: '/app/inventory/listInventory',
        param: {
          warehouseId: '${warehouse2.warehouseId}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          let beef = content.find(row => row.name === '牛肉');
          CheckUtil.expectEqual(beef != null, true, '目标仓listInventory缺少牛肉');
          CheckUtil.expectEqual(beef.inventory?.cnt, 10, `牛肉盘点数量应为10，实际${beef.inventory?.cnt}`);
        }
      }),
      new Action({
        name: 'listOtherType',
        remark: '目标仓应有消耗类型报损',
        url: '/app/otherType/listOtherType',
        param: {
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(
            content.some(row => row.name === '报损'),
            true,
            '目标仓listOtherType缺少报损'
          );
        }
      }),
      new Action({
        name: 'listOtherUse',
        remark: '目标仓应有复制过来的其他消耗',
        url: '/app/otherUse/listOtherUse',
        param: {
          warehouseId: '${warehouse2.warehouseId}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(content.length >= 1, true, '目标仓listOtherUse应至少有1条');
        },
        buildVariable(result) {
          let content: any[] = result.result.content ?? [];
          return {
            targetOtherUseId: content[0]?.otherUseId
          };
        }
      }),
      new Action({
        name: 'listOtherItem',
        remark: '目标仓其他消耗明细应为牛肉数量 1',
        url: '/app/otherItem/listOtherItem',
        param: {
          otherUseId: '${targetOtherUseId}',
          warehouseId: '${warehouse2.warehouseId}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          let beef = content.find(row => row.name === '牛肉');
          CheckUtil.expectEqual(beef != null, true, '目标仓listOtherItem缺少牛肉');
          CheckUtil.expectEqual(beef.cnt, 1, `牛肉消耗数量应为1，实际${beef.cnt}`);
        },
        buildVariable(result) {
          let content: any[] = result.result.content ?? [];
          let beef = content.find(row => row.name === '牛肉');
          return {
            targetOtherItemId: beef?.otherItemId
          };
        }
      }),
      new CheckStockRecordNoteItemId()
    ];
  }
}

function expectStockRecordNoteItemId(content: any[], noteItemType: string, expectedId: any, msg: string) {
  let rows = (content ?? []).filter((row: any) => row.noteItemType === noteItemType);
  CheckUtil.expectEqual(rows.length >= 1, true, `目标仓stockRecord缺少 noteItemType=${noteItemType}`);
  for (let row of rows) {
    CheckUtil.expectEqual(String(row.noteItemId), String(expectedId), `${msg}，实际=${row.noteItemId}`);
  }
}

/** 按 noteItemType 核对 stockRecord.noteItemId 已换成目标仓主键 */
class CheckStockRecordNoteItemId extends TestCase {
  constructor() {
    super({ remark: 'listStockRecord4Inventory：noteItemId 分别等于目标仓 inventory/noteItem/otherItem/product 主键' });
  }

  getName(): string {
    return '校验stockRecord.noteItemId';
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new Action({
        name: '查询目标仓盘点主键',
        remark: 'inventoryId 供 noteItemType=inventory 对照',
        url: '/free/query',
        param: {
          warehouseGroupId: '${warehouse2.warehouseGroupId}',
          array: [{
            table: 'inventory',
            query: {
              warehouseId: '${warehouse2.warehouseId}',
              warehouseGroupId: '${warehouse2.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        check(result) {
          let list: any[] = result.result.inventory ?? [];
          CheckUtil.expectEqual(list.length >= 1, true, '目标仓应有盘点记录');
        },
        buildVariable(result) {
          let list: any[] = result.result.inventory ?? [];
          let beefId = variable.targetMaterial?.牛肉;
          let inv = list.find((row: any) => String(row.materialId) === String(beefId)) ?? list[0];
          return {
            targetInventoryId: inv?.inventoryId
          };
        }
      }),
      new Action({
        name: 'listStockRecord4Inventory',
        remark: '按 noteItemType 核对 noteItemId',
        url: '/app/stockRecord/listStockRecord4Inventory',
        param: {
          materialId: '${targetMaterial.牛肉}',
          warehouseId: '${warehouse2.warehouseId}',
          warehouseGroupId: '${warehouse2.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          expectStockRecordNoteItemId(content, 'inventory', variable.targetInventoryId, 'inventory 的 noteItemId 应为目标盘点主键');
          expectStockRecordNoteItemId(content, 'noteItem', variable.targetNoteItemId, 'noteItem 的 noteItemId 应为目标订单明细主键');
          expectStockRecordNoteItemId(content, 'other_item', variable.targetOtherItemId, 'other_item 的 noteItemId 应为目标其他消耗明细主键');
          expectStockRecordNoteItemId(content, 'product', variable.targetProduct?.红烧牛肉, 'product 的 noteItemId 应为目标餐品主键');
        }
      })
    ];
  }
}

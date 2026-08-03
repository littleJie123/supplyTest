import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreTestWithMeatAndSupplier from "../PreTestWithMeatAndSupplier";
import Action from "../../action/Action";
import QueryAction from "../../action/QueryAction";
import ProcessNote from "../../action/note/ProcessNote";
import ChangeWarehouse2Supplier from "../../action/user/ChangeWarehouse2Supplier";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import LinkNoteItemUtil from "../../util/LinkNoteItemUtil";
import MaterialLinkUtil from "../../util/MaterialLinkUtil";
import StockUtil from "../../util/StockUtil";

type DualMode = 'purchase' | 'send' | 'outstock' | 'instock';

interface DualExpect {
  name: string;
  cnt: number;
}

interface DualCheckOpt {
  label: string;
  storeNoteId: string;
  linkNoteId: string;
  mode: DualMode;
  expectStore?: DualExpect[];
  checkUnits?: boolean;
}

/**
 * 羊(包)/牛(克) 链接场景（见同目录 FlowMeatSupplierLink.md）。
 * 首单走供应商发货/出库；第二单走餐厅入库；每步后校验两端数量。
 */
export default class extends TestCase {
  constructor() {
    super({
      remark: '羊包牛克：创建/发送/发货/出库/入库，每步双端校验数量'
    })
  }

  getName(): string {
    return '羊牛供应商链接单位'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTestWithMeatAndSupplier(),

      // —— 首单：创建+发送+接单后，双端采购量 ——
      ...this.buildDualCheck({
        label: '首单创建发送接单后',
        storeNoteId: '${meatLinkNoteId}',
        linkNoteId: '${meatLinkLinkNoteId}',
        mode: 'purchase',
        expectStore: [
          { name: '羊肉', cnt: 1 },
          { name: '牛肉', cnt: 100 },
        ],
        checkUnits: true,
      }),

      new ChangeWarehouse2Supplier(),

      new QueryAction({
        name: '加载供应商首单明细供发货',
        url: '/app/noteItem/listNoteItem',
        query: { noteId: '${meatLinkLinkNoteId}' }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          return { noteItems: result.result.content };
        }
      }),

      new ProcessNote({
        action: 'send',
        noteId: '${meatLinkLinkNoteId}',
        noteItems: '${noteItems}',
        buildItem(item) {
          item.sendCnt = item.cnt;
          return item;
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),

      ...this.buildDualCheck({
        label: '首单发货后',
        storeNoteId: '${meatLinkNoteId}',
        linkNoteId: '${meatLinkLinkNoteId}',
        mode: 'send',
        expectStore: [
          { name: '羊肉', cnt: 1 },
          { name: '牛肉', cnt: 100 },
        ],
      }),

      new QueryAction({
        name: '加载供应商首单明细供出库',
        url: '/app/noteItem/listNoteItem',
        query: { noteId: '${meatLinkLinkNoteId}' }
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          return { noteItems: result.result.content };
        }
      }),

      new ProcessNote({
        action: 'instock',
        noteId: '${meatLinkLinkNoteId}',
        noteItems: '${noteItems}',
        buildItem(item) {
          item.instockCnt = item.sendCnt ?? item.cnt;
          return item;
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),

      ...this.buildDualCheck({
        label: '首单出库后',
        storeNoteId: '${meatLinkNoteId}',
        linkNoteId: '${meatLinkLinkNoteId}',
        mode: 'outstock',
        expectStore: [
          { name: '羊肉', cnt: 1 },
          { name: '牛肉', cnt: 100 },
        ],
      }),

      new ChangeWarehouse(),

      // —— 第二单：创建（自动链接）——
      new Action({
        remark: '第二单：再发羊1包+牛50克（已链接，创建时自动出链接单）',
        name: 'createNote第二单',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [
            {
              materialId: '${meatLinkOrder.羊肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 1,
              buyUnitFee: '${meatLinkOrder.羊肉.buyUnitFee}',
              stockUnitsId: '${meatLinkOrder.羊肉.stockUnitsId}',
              price: '${meatLinkOrder.羊肉.price}',
              stockBuyUnitFee: '${meatLinkOrder.羊肉.stockBuyUnitFee}'
            },
            {
              materialId: '${meatLinkOrder.牛肉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 50,
              buyUnitFee: '${meatLinkOrder.牛肉.buyUnitFee}',
              stockUnitsId: '${meatLinkOrder.牛肉.stockUnitsId}',
              price: '${meatLinkOrder.牛肉.price}',
              stockBuyUnitFee: '${meatLinkOrder.牛肉.stockBuyUnitFee}'
            }
          ]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          return {
            meatLinkNoteId2: notes[0]?.noteId,
            meatLinkNoteIds2: ArrayUtil.toArray(notes, 'noteId'),
          };
        },
        check(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          if (notes[0]?.noteId == null) {
            throw new Error(`第二单 createNote 未返回 noteId: ${JSON.stringify(result.result)}`);
          }
        }
      }),

      new QueryAction({
        name: '第二单创建后取 linkNoteId',
        url: '/app/note/listNote',
        query: { noteId: '${meatLinkNoteId2}' }
      }, {
        buildVariable(result) {
          const row = result.result.content?.[0];
          return { meatLinkLinkNoteId2: row?.linkNoteId };
        },
        check(result) {
          const row = result.result.content?.[0];
          CheckUtil.expectEqual(
            row?.linkNoteId != null && row.linkNoteId !== 0,
            true,
            '第二单创建后应自动生成 linkNoteId'
          );
        }
      }),

      ...this.buildDualCheck({
        label: '第二单创建后',
        storeNoteId: '${meatLinkNoteId2}',
        linkNoteId: '${meatLinkLinkNoteId2}',
        mode: 'purchase',
        expectStore: [
          { name: '羊肉', cnt: 1 },
          { name: '牛肉', cnt: 50 },
        ],
        checkUnits: true,
      }),

      new Action({
        remark: '发送第二单',
        name: 'sendNote第二单',
        url: '/app/note/sendNote',
        method: 'POST',
        param: {
          noteIds: '${meatLinkNoteIds2}',
          status: 'normal',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }),

      ...this.buildDualCheck({
        label: '第二单发送后',
        storeNoteId: '${meatLinkNoteId2}',
        linkNoteId: '${meatLinkLinkNoteId2}',
        mode: 'purchase',
        expectStore: [
          { name: '羊肉', cnt: 1 },
          { name: '牛肉', cnt: 50 },
        ],
      }),

      new QueryAction({
        name: '加载第二单餐厅明细供入库',
        url: '/app/noteItem/listNoteItem',
        query: { noteId: '${meatLinkNoteId2}' }
      }, {
        buildVariable(result) {
          return { noteItems: result.result.content };
        }
      }),

      new ProcessNote({
        action: 'instock',
        noteId: '${meatLinkNoteId2}',
        noteItems: '${noteItems}',
        buildItem(item) {
          item.instockCnt = item.cnt;
          return item;
        }
      }),

      ...this.buildDualCheck({
        label: '第二单入库后',
        storeNoteId: '${meatLinkNoteId2}',
        linkNoteId: '${meatLinkLinkNoteId2}',
        mode: 'instock',
        expectStore: [
          { name: '羊肉', cnt: 1 },
          { name: '牛肉', cnt: 50 },
        ],
      }),
    ]
  }

  /**
   * 拉餐厅 + 供应商明细，按 mode 比对两端数量（经 linkUnitFee 换算）。
   */
  private buildDualCheck(opt: DualCheckOpt): BaseTest[] {
    const variable = this.getVariable();
    const self = this;
    return [
      new QueryAction({
        name: `${opt.label}：查餐厅明细`,
        url: '/app/noteItem/listNoteItem',
        query: { noteId: opt.storeNoteId }
      }, {
        buildVariable(result) {
          return { dualCheckStoreItems: result.result.content ?? [] };
        },
        check(result) {
          const content = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 2, `${opt.label}餐厅明细应为两行`);
          if (opt.expectStore) {
            for (const expect of opt.expectStore) {
              const row = content.find((r: any) => r.name === expect.name);
              CheckUtil.expectEqual(row != null, true, `${opt.label}缺少${expect.name}`);
              const cntObj = self.pickCnt(row, opt.mode, 'store');
              CheckUtil.expectEqual(
                cntObj?.cnt,
                expect.cnt,
                `${opt.label}餐厅${expect.name}数量应为${expect.cnt}`
              );
            }
          }
          if (opt.checkUnits) {
            const yang = content.find((r: any) => r.name === '羊肉');
            const niu = content.find((r: any) => r.name === '牛肉');
            CheckUtil.expectEqual(
              String(yang?.stockUnitsId),
              String(variable.meatLinkOrder?.羊肉?.stockUnitsId),
              `${opt.label}羊肉应为包`
            );
            CheckUtil.expectEqual(
              String(niu?.stockUnitsId),
              String(variable.meatLinkOrder?.牛肉?.stockUnitsId),
              `${opt.label}牛肉应为克`
            );
          }
          for (const row of content) {
            if (row.linkNoteItemId == null || row.linkNoteItemId === 0) {
              throw new Error(`${opt.label}餐厅明细缺少 linkNoteItemId: ${row.name}`);
            }
          }
        }
      }),

      new QueryAction({
        name: `${opt.label}：查供应商明细并双端比对`,
        url: '/app/noteItem/listNoteItem',
        query: { noteId: opt.linkNoteId }
      }, {
        warehouseType: 'supplierWarehouse',
        check(result) {
          const storeItems: any[] = variable.dualCheckStoreItems ?? [];
          const supplierItems: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(supplierItems.length, 2, `${opt.label}供应商明细应为两行`);
          for (const store of storeItems) {
            const supplier = supplierItems.find(
              (s: any) => String(s.noteItemId) === String(store.linkNoteItemId)
            );
            CheckUtil.expectEqual(supplier != null, true, `${opt.label}未找到链接明细${store.name}`);
            if (opt.checkUnits) {
              CheckUtil.expectEqual(
                String(supplier.stockUnitsId),
                String(store.stockUnitsId),
                `${opt.label}${store.name}链接单位应与餐厅侧一致`
              );
            }
            self.compareDual(store, supplier, opt.mode, opt.label);
          }
        }
      }),
    ];
  }

  /** 取本端用于期望值断言的数量对象 */
  private pickCnt(row: any, mode: DualMode, side: 'store' | 'supplier'): { cnt: number; buyUnitFee: number } {
    if (mode === 'purchase') {
      return row.purcharse;
    }
    if (mode === 'send') {
      return row.sendCnt;
    }
    if (mode === 'outstock') {
      return side === 'supplier' ? row.instock : row.linkInstockCnt;
    }
    // instock：餐厅本方 instock，供应商 linkInstockCnt
    return side === 'store' ? row.instock : row.linkInstockCnt;
  }

  private compareDual(store: any, supplier: any, mode: DualMode, label: string) {
    const name = store.name;
    if (mode === 'instock') {
      LinkNoteItemUtil.compareStoreAndLink(store, supplier);
      return;
    }

    if (mode === 'outstock') {
      CheckUtil.expectEqual(supplier.instock != null, true, `${label}${name}供应商缺少instock`);
      CheckUtil.expectEqual(store.linkInstockCnt != null, true, `${label}${name}餐厅缺少linkInstockCnt`);
      // 供应商出库同步到餐厅：以供应商为源换算
      const materialLink = {
        unitFee: supplier.linkUnitFee,
        linkUnitFee: store.linkUnitFee
      };
      const expectedCnt = MaterialLinkUtil.parseCnt(materialLink, supplier.instock.cnt);
      CheckUtil.expectEqual(
        StockUtil.isEq(
          { cnt: expectedCnt, buyUnitFee: store.linkInstockCnt.buyUnitFee },
          store.linkInstockCnt
        ),
        true,
        `${label}${name}出库后餐厅linkInstockCnt与供应商instock不一致`
      );
      CheckUtil.expectEqual(
        StockUtil.isEq(supplier.purcharse, supplier.instock),
        true,
        `${label}${name}供应商出库数量应等于采购量`
      );
      return;
    }

    const storeCol = mode === 'send' ? 'sendCnt' : 'purcharse';
    const supplierCol = storeCol;
    CheckUtil.expectEqual(store[storeCol] != null, true, `${label}${name}餐厅缺少${storeCol}`);
    CheckUtil.expectEqual(supplier[supplierCol] != null, true, `${label}${name}供应商缺少${supplierCol}`);
    CheckUtil.expectEqual(store.linkUnitFee != null, true, `${label}${name}主单缺少linkUnitFee`);
    CheckUtil.expectEqual(supplier.linkUnitFee != null, true, `${label}${name}链接单缺少linkUnitFee`);

    const materialLink = {
      unitFee: store.linkUnitFee,
      linkUnitFee: supplier.linkUnitFee
    };
    const expectedCnt = MaterialLinkUtil.parseCnt(materialLink, store[storeCol].cnt);
    CheckUtil.expectEqual(
      StockUtil.isEq(
        { cnt: expectedCnt, buyUnitFee: supplier[supplierCol].buyUnitFee },
        supplier[supplierCol]
      ),
      true,
      `${label}${name}两端${storeCol}不一致：餐厅换算后${expectedCnt}，供应商${JSON.stringify(supplier[supplierCol])}`
    );
  }
}

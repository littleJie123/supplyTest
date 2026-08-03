import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import PreTestWithMeat from "./PreTestWithMeat";
import Action from "../action/Action";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import SaveMaterial from "../action/material/SaveMaterial";
import SaveShareData from "../action/shareData/SaveShareData";
import ChangeWarehouse2Supplier from "../action/user/ChangeWarehouse2Supplier";
import ChangeWarehouse from "../action/user/ChangeWarehouse";
import QueryAction from "../action/QueryAction";

/**
 * 在 PreTestWithMeat 基础上：
 * - 餐厅侧羊肉/牛肉规格均为 1包=100克，默认采购单位：羊肉=包、牛肉=克
 * - 注册供应商仓，供应商侧物料只有一个单位：羊肉（包）、牛肉（克）
 * - 餐厅对供应商1下单羊肉+牛肉并发送 → 供应商接单建立链接
 */
export default class extends TestCase {
  constructor() {
    super({
      remark: '前置：肉类规格 + 供应商仓 + 羊(包)/牛(克) 发单接单'
    })
  }

  getName(): string {
    return '初始化肉类并供应商接单'
  }

  needInScreen(): boolean {
    return false
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new PreTestWithMeat(),

      new Action({
        remark: '餐厅：羊肉默认采购单位改为包',
        name: '更新羊肉默认单位为包',
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${materialMap.羊肉.materialId}',
          name: '羊肉',
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: 200,
            unitsName: '包',
            moc: 0
          }],
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }),

      new Action({
        remark: '餐厅：牛肉默认采购单位改为克',
        name: '更新牛肉默认单位为克',
        url: '/app/material/updateMaterial',
        method: 'POST',
        param: {
          materialId: '${materialMap.牛肉.materialId}',
          name: '牛肉',
          remark: '',
          img: [],
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 100, isSupplier: true }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: 2,
            unitsName: '克',
            moc: 0
          }],
          category: { categoryId: '${categoryMap.肉类}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }),

      new Action({
        remark: '读取餐厅默认 SM 单位/价，供下单使用',
        name: 'listMaterialByCategory取羊牛单位',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          materialId: [
            '${materialMap.羊肉.materialId}',
            '${materialMap.牛肉.materialId}',
          ],
        }
      }, {
        buildVariable(result) {
          const content = result.result.content ?? [];
          const yang = content.find((row: any) => row.name === '羊肉');
          const niu = content.find((row: any) => row.name === '牛肉');
          return {
            meatLinkOrder: {
              羊肉: {
                materialId: yang?.materialId,
                stockUnitsId: yang?.stockUnitsId,
                price: yang?.supplierMaterial?.price ?? yang?.price ?? 200,
                buyUnitFee: yang?.supplierMaterial?.buyUnitFee ?? -100,
                stockBuyUnitFee: yang?.supplierMaterial?.buyUnitFee ?? -100,
              },
              牛肉: {
                materialId: niu?.materialId,
                stockUnitsId: niu?.stockUnitsId,
                price: niu?.supplierMaterial?.price ?? niu?.price ?? 2,
                buyUnitFee: niu?.supplierMaterial?.buyUnitFee ?? 1,
                stockBuyUnitFee: niu?.supplierMaterial?.buyUnitFee ?? 1,
              },
            }
          };
        },
        check(result) {
          const content = result.result.content ?? [];
          const yang = content.find((row: any) => row.name === '羊肉');
          const niu = content.find((row: any) => row.name === '牛肉');
          if (yang == null || niu == null) {
            throw new Error('未找到羊肉/牛肉');
          }
          const yangBag = (yang.buyUnit ?? []).find((bu: any) => bu.name === '包');
          const niuGram = (niu.buyUnit ?? []).find((bu: any) => bu.name === '克');
          CheckUtil.expectEqual(
            String(yang.stockUnitsId),
            String(yangBag?.unitsId),
            '羊肉默认采购单位应为包'
          );
          CheckUtil.expectEqual(
            String(niu.stockUnitsId),
            String(niuGram?.unitsId),
            '牛肉默认采购单位应为克'
          );
        }
      }),

      new AddWarehouse({
        name: '肉类链接供应商仓',
        variableType: 'supplierWarehouse',
        type: 'supplier'
      }),

      new SaveMaterial({
        name: '羊肉',
        buyUnit: [
          { name: '包', fee: 1, isSupplier: true }
        ]
      }, {
        warehouseType: 'supplierWarehouse'
      }),

      new SaveMaterial({
        name: '牛肉',
        buyUnit: [
          { name: '克', fee: 1, isSupplier: true }
        ]
      }, {
        warehouseType: 'supplierWarehouse'
      }),

      new Action({
        remark: '餐厅向供应商1下单：羊肉1包、牛肉100克',
        name: 'createNote羊包牛克',
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
              cnt: 100,
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
            meatLinkNoteId: notes[0]?.noteId,
            meatLinkNoteIds: ArrayUtil.toArray(notes, 'noteId'),
          };
        },
        check(result) {
          const notes = Array.isArray(result.result) ? result.result : (result.result?.content ?? []);
          if (notes[0]?.noteId == null) {
            throw new Error(`createNote 未返回 noteId: ${JSON.stringify(result.result)}`);
          }
        }
      }),

      new Action({
        remark: '发送订单',
        name: 'sendNote羊牛',
        url: '/app/note/sendNote',
        method: 'POST',
        param: {
          noteIds: '${meatLinkNoteIds}',
          status: 'normal',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }),

      new SaveShareData({
        data: { noteId: '${meatLinkNoteId}' }
      }),

      new Action({
        remark: '查询分享单',
        name: 'shareNote羊牛',
        url: '/share/shareNote',
        param: {
          shareDataNo: '${shareDataNo}',
          usersId: '${usersId}',
        }
      }),

      new ChangeWarehouse2Supplier(),

      new Action({
        remark: '供应商接单（建立链接）',
        name: 'linkNote羊牛',
        url: '/app/note/linkNote',
        method: 'POST',
        param: {
          warehouseId: '${supplierWarehouse.warehouseId}',
          _shareDataNo: '${shareDataNo}',
        }
      }, {
        warehouseType: 'supplierWarehouse'
      }),

      new ChangeWarehouse(),

      new QueryAction({
        name: '记录链接单 noteId',
        url: '/app/note/listNote',
        query: {
          noteId: '${meatLinkNoteId}'
        }
      }, {
        buildVariable(result) {
          const row = result.result.content?.[0];
          return {
            meatLinkLinkNoteId: row?.linkNoteId,
          };
        },
        check(result) {
          const row = result.result.content?.[0];
          CheckUtil.expectEqual(
            row?.linkNoteId != null && row.linkNoteId !== 0,
            true,
            '餐厅单缺少 linkNoteId'
          );
        }
      }),

      new Action({
        remark: '记录链接明细 id，确认羊/牛单位',
        name: 'listNoteItem羊牛链接',
        url: '/app/noteItem/listNoteItem',
        method: 'POST',
        param: {
          noteId: '${meatLinkNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
        }
      }, {
        buildVariable(result) {
          const content = result.result.content ?? [];
          return {
            meatLinkNoteItems: content,
            meatLinkNoteItemIds: ArrayUtil.toArray(content, 'noteItemId'),
            meatLinkLinkNoteItemIds: ArrayUtil.toArray(content, 'linkNoteItemId'),
          };
        },
        check(result) {
          const content = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 2, '餐厅单应有羊/牛两行明细');
          const yang = content.find((row: any) =>
            String(row.materialId) === String(variable.meatLinkOrder?.羊肉?.materialId)
            || row.name === '羊肉');
          const niu = content.find((row: any) =>
            String(row.materialId) === String(variable.meatLinkOrder?.牛肉?.materialId)
            || row.name === '牛肉');
          if (yang == null || niu == null) {
            throw new Error(`明细缺少羊肉/牛肉: ${JSON.stringify(content.map((r: any) => r.name))}`);
          }
          CheckUtil.expectEqual(
            String(yang.stockUnitsId),
            String(variable.meatLinkOrder.羊肉.stockUnitsId),
            '羊肉明细应为包单位'
          );
          CheckUtil.expectEqual(
            String(niu.stockUnitsId),
            String(variable.meatLinkOrder.牛肉.stockUnitsId),
            '牛肉明细应为克单位'
          );
          for (const row of content) {
            if (row.linkNoteItemId == null || row.linkNoteItemId === 0) {
              throw new Error(`明细缺少 linkNoteItemId: ${row.name}`);
            }
          }
        }
      }),
    ]
  }
}

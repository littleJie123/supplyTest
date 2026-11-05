import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import ListMaterial from "../../action/material/ListMaterial";
import Recal from "../../action/Recal";
import CheckArray from "../../action/CheckArray";
import StockUtil from "../../util/StockUtil";

/** 与 NumUtil.toNum(n, 2) 一致。 */
function round2(num: number): number {
  let x = num * 100
  let ret = Math.round(x)
  if (Math.abs(x - (ret + 1)) < 0.001) {
    ret = ret + 1
  }
  return ret / 100
}

/**
 * 进销存 /app/state2/stateWarehouse。步骤见 FlowStateWarehouse.md。
 * 统计区间 2026-09-01 ~ 2026-09-30，8月31日盘点在期初。
 *
 * 期初按供应商单价：牛10包×200、羊10包×150、白菜20斤×100、萝卜20斤×50 = 6500。
 * 文档盘点写成白菜20包、萝卜20包，物料单位是斤，这里按20斤。
 * 9月1日牛肉50g、羊肉10g，价格0。入库金额不变，noPrice=true。
 * 其他入库牛肉10包×50元。清炒萝卜无 BOM，销量20份，cost=0，noBom=1。
 * 塑料杯不进任何餐品 BOM。9月7日入库10个×2元，9月30日盘成4个，差额12元留在成本里。
 * 9月30日盘到1，输入成本不参与库存金额，processSet 按最新批次回填。期末 牛50、羊300、白菜200、萝卜100、杯8。
 */
export default class extends TestCase {
  getName(): string {
    return '测试统计【statewarehouse】'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        remark: '牛肉羊肉按包，白菜萝卜按斤',
        materialsOpts: [
          {
            name: '牛肉', category: '肉类', unit: '包', code: 'MAT_BEEF',
            suppliers: [{ isDef: true, supplierId: '${supplierMap.供应商1}', price: 200 }]
          },
          {
            name: '羊肉', category: '肉类', unit: '包', code: 'MAT_LAMB',
            suppliers: [{ isDef: true, supplierId: '${supplierMap.供应商2}', price: 150 }]
          },
          {
            name: '白菜', category: '蔬菜', unit: '斤', code: 'MAT_CABBAGE',
            suppliers: [{ isDef: true, supplierId: '${supplierMap.供应商1}', price: 100 }]
          },
          {
            name: '萝卜', category: '蔬菜', unit: '斤', code: 'MAT_RADISH',
            suppliers: [{ isDef: true, supplierId: '${supplierMap.供应商2}', price: 50 }]
          },
          {
            name: '塑料杯', category: '蔬菜', unit: '个', code: 'MAT_CUP',
            suppliers: [{ isDef: true, supplierId: '${supplierMap.供应商1}', price: 2 }]
          }
        ]
      }),
      this.saveBuyUnit('牛肉', [
        { name: '克', fee: 1 },
        { name: '包', fee: 100, isSupplier: true }
      ], '包'),
      this.saveBuyUnit('羊肉', [
        { name: '克', fee: 1 },
        { name: '包', fee: 100, isSupplier: true }
      ], '包'),
      this.saveBuyUnit('白菜', [
        { name: '克', fee: 1 },
        { name: '斤', fee: 500, isSupplier: true }
      ], '斤'),
      this.saveBuyUnit('萝卜', [
        { name: '克', fee: 1 },
        { name: '斤', fee: 500, isSupplier: true }
      ], '斤'),
      this.saveBuyUnit('塑料杯', [
        { name: '个', fee: 1, isSupplier: true }
      ], '个'),
      new ListMaterial(),

      ...this.saveProduct('羊肉炒白菜', [
        { material: '羊肉', cnt: 10, buyUnitFee: 100, price: 120, stockBuyUnitFee: 1 },
        { material: '白菜', cnt: 20, buyUnitFee: 500, price: 80, stockBuyUnitFee: 1 }
      ]),
      ...this.saveProduct('红烧牛肉', [
        { material: '牛肉', cnt: 30, buyUnitFee: 100, price: 240, stockBuyUnitFee: 1 }
      ]),
      ...this.saveProduct('萝卜煮羊肉', [
        { material: '萝卜', cnt: 40, buyUnitFee: 500, price: 60, stockBuyUnitFee: 1 },
        { material: '羊肉', cnt: 30, buyUnitFee: 100, price: 120, stockBuyUnitFee: 1 }
      ]),
      new Action({
        name: '增加餐品:清炒萝卜',
        remark: '无BOM',
        url: '/app/product/addProduct',
        param: { name: '清炒萝卜' }
      }),
      this.listProduct(),

      this.inventory('8月31日盘点', '2026-08-31', [
        { material: '牛肉', cnt: 10, buyUnitFee: 1, cost: 2000 },
        { material: '羊肉', cnt: 10, buyUnitFee: 1, cost: 1500 },
        { material: '白菜', cnt: 20, buyUnitFee: 1, cost: 2000 },
        { material: '萝卜', cnt: 20, buyUnitFee: 1, cost: 1000 }
      ]),

      ...this.instockNote('9月1日供应商1', '2026-09-01', 'sep1Note1', [
        { material: '牛肉', supplier: '供应商1', cnt: 50, buyUnitFee: 100, price: 0, stockBuyUnitFee: 1 }
      ]),
      ...this.instockNote('9月1日供应商2', '2026-09-01', 'sep1Note2', [
        { material: '羊肉', supplier: '供应商2', cnt: 10, buyUnitFee: 100, price: 0, stockBuyUnitFee: 1 }
      ]),

      ...this.instockNote('9月2日供应商1', '2026-09-02', 'sep2Note1', [
        { material: '牛肉', supplier: '供应商1', cnt: 10, buyUnitFee: 1, price: 200, stockBuyUnitFee: 1 },
        { material: '白菜', supplier: '供应商1', cnt: 12, buyUnitFee: 1, price: 100, stockBuyUnitFee: 1 }
      ]),
      ...this.instockNote('9月2日供应商2', '2026-09-02', 'sep2Note2', [
        { material: '羊肉', supplier: '供应商2', cnt: 11, buyUnitFee: 1, price: 150, stockBuyUnitFee: 1 },
        { material: '萝卜', supplier: '供应商2', cnt: 13, buyUnitFee: 1, price: 50, stockBuyUnitFee: 1 }
      ]),

      this.sales('羊肉炒白菜', 100, '2026-09-03'),
      this.sales('红烧牛肉', 80, '2026-09-03'),
      this.sales('萝卜煮羊肉', 60, '2026-09-03'),
      this.sales('清炒萝卜', 20, '2026-09-03'),

      this.listNoteItems('sep2Note1', 'sep2Items1'),
      this.listNoteItems('sep2Note2', 'sep2Items2'),
      ...this.backSep4(),

      ...this.instockNote('9月5日供应商1', '2026-09-05', 'sep5Note1', [
        { material: '牛肉', supplier: '供应商1', cnt: 10, buyUnitFee: 1, price: 400, stockBuyUnitFee: 1 },
        { material: '白菜', supplier: '供应商1', cnt: 10, buyUnitFee: 1, price: 200, stockBuyUnitFee: 1 }
      ]),
      ...this.instockNote('9月5日供应商2', '2026-09-05', 'sep5Note2', [
        { material: '羊肉', supplier: '供应商2', cnt: 10, buyUnitFee: 1, price: 300, stockBuyUnitFee: 1 },
        { material: '萝卜', supplier: '供应商2', cnt: 10, buyUnitFee: 1, price: 100, stockBuyUnitFee: 1 }
      ]),

      ...this.otherUseSep6(),
      ...this.otherInstockSep6(),

      ...this.instockNote('9月7日塑料杯', '2026-09-07', 'sep7Note', [
        { material: '塑料杯', supplier: '供应商1', cnt: 10, buyUnitFee: 1, price: 2, stockBuyUnitFee: 1 }
      ]),

      this.inventory('9月30日盘点', '2026-09-30', [
        { material: '牛肉', cnt: 1, buyUnitFee: 1, cost: 0 },
        { material: '羊肉', cnt: 1, buyUnitFee: 1, cost: 0 },
        { material: '白菜', cnt: 1, buyUnitFee: 1, cost: 0 },
        { material: '萝卜', cnt: 1, buyUnitFee: 1, cost: 0 },
        { material: '塑料杯', cnt: 4, buyUnitFee: 1, cost: 0 }
      ]),

      new Recal(),
      this.checkState({
        name: '统计9月',
        begin: '2026-09-01',
        end: '2026-09-30',
        data: {
          beginAmount: 6500,
          instockAmount: 15520,
          endAmount: 658,
          amount: 21362,
          costOfTheory: 9728,
          endAmountOfTheory: 12292,
          otherUseAmount: 700,
          cost: 20662,
          costDiff: 10934
        },
        info: {
          hasBeginInventory: true,
          afterBeginInventoryDay: '2026-09-30',
          hasEndInventory: true,
          noPrice: true,
          noSales: false,
          noBom: true,
          noOtherUse: false,
          noOtherInstock: false
        }
      }),
      this.checkStock(),
      this.checkState({
        name: '统计9月1日到9月5日',
        begin: '2026-09-01',
        end: '2026-09-05',
        data: {
          beginAmount: 6500,
          instockAmount: 15000,
          endAmount: 13860,
          amount: 7640,
          costOfTheory: 9728,
          endAmountOfTheory: 11772,
          otherUseAmount: 0,
          cost: 7640,
          costDiff: -2088
        },
        info: {
          hasBeginInventory: true,
          afterBeginInventoryDay: null,
          hasEndInventory: false,
          noPrice: true,
          noSales: false,
          noBom: true,
          noOtherUse: true,
          noOtherInstock: true
        }
      }),
      this.checkState({
        name: '统计9月1日到9月2日',
        begin: '2026-09-01',
        end: '2026-09-02',
        data: {
          beginAmount: 6500,
          instockAmount: 5500,
          endAmount: 12000,
          amount: 0,
          costOfTheory: 0,
          endAmountOfTheory: 12000,
          otherUseAmount: 0,
          cost: 0,
          costDiff: 0
        },
        info: {
          hasBeginInventory: true,
          afterBeginInventoryDay: null,
          hasEndInventory: false,
          noPrice: true,
          noSales: true,
          noBom: false,
          noOtherUse: true,
          noOtherInstock: true
        }
      }),
      this.checkCost({
        name: '成本9月不限物料',
        begin: '2026-09-01',
        end: '2026-09-30',
        cost: 20662
      }),
      this.checkCost({
        name: '成本9月销售BOM内',
        begin: '2026-09-01',
        end: '2026-09-30',
        notInBom: false,
        cost: 20650
      }),
      this.checkCost({
        name: '成本9月销售BOM内0',
        begin: '2026-09-01',
        end: '2026-09-30',
        notInBom: 0,
        cost: 20650
      }),
      this.checkCost({
        name: '成本9月不在销售BOM',
        begin: '2026-09-01',
        end: '2026-09-30',
        notInBom: true,
        cost: 12
      }),
      this.checkCost({
        name: '成本9月不在销售BOM1',
        begin: '2026-09-01',
        end: '2026-09-30',
        notInBom: 1,
        cost: 12
      }),
      this.checkMaterialAmount({
        name: '物料成本9月',
        begin: '2026-09-01',
        end: '2026-09-30',
        data: {
          beginAmount: 6500,
          instockAmount: 15520,
          endAmount: 658,
          amount: 21362,
          costOfTheory: 9728,
          endAmountOfTheory: 12292,
          otherUseAmount: 700,
          cost: 20662,
          costDiff: 10934
        }
      }),
      this.checkMaterialAmount({
        name: '物料成本9月1日到9月5日',
        begin: '2026-09-01',
        end: '2026-09-05',
        data: {
          beginAmount: 6500,
          instockAmount: 15000,
          endAmount: 13860,
          amount: 7640,
          costOfTheory: 9728,
          endAmountOfTheory: 11772,
          otherUseAmount: 0,
          cost: 7640,
          costDiff: -2088
        }
      }),
      this.checkMaterialAmount({
        name: '物料成本9月1日到9月2日',
        begin: '2026-09-01',
        end: '2026-09-02',
        data: {
          beginAmount: 6500,
          instockAmount: 5500,
          endAmount: 12000,
          amount: 0,
          costOfTheory: 0,
          endAmountOfTheory: 12000,
          otherUseAmount: 0,
          cost: 0,
          costDiff: 0
        }
      }),
      this.checkMaterialAmount({
        name: '物料成本9月不在销售BOM',
        begin: '2026-09-01',
        end: '2026-09-30',
        notInBom: true,
        names: ['塑料杯'],
        data: {
          beginAmount: 0,
          instockAmount: 20,
          endAmount: 8,
          amount: 12,
          costOfTheory: 0,
          endAmountOfTheory: 20,
          otherUseAmount: 0,
          cost: 12,
          costDiff: 12
        }
      })
    ]
  }

  private saveBuyUnit(name: string, buyUnit: any[], supplierUnitsName: string): Action {
    return new Action({
      name: `转化规格:${name}`,
      url: '/app/material/saveBuyUnit',
      param: {
        materialId: `\${materialMap.${name}.materialId}`,
        warehouseId: '${warehouse.warehouseId}',
        buyUnit,
        supplierUnitsName
      }
    })
  }

  private saveProduct(productName: string, lines: Array<{
    material: string
    cnt: number
    buyUnitFee: number
    price: number
    stockBuyUnitFee: number
  }>): BaseTest[] {
    let boms = lines.map(line => ({
      materialId: `\${materialMap.${line.material}.materialId}`,
      cnt: line.cnt,
      buyUnitFee: line.buyUnitFee,
      yieldRate: 1,
      netCnt: line.cnt,
      price: line.price,
      stockBuyUnitFee: line.stockBuyUnitFee
    }))
    return [
      new Action({
        name: `增加餐品:${productName}`,
        url: '/app/product/addProduct',
        param: { name: productName }
      }, {
        buildVariable(result) {
          return { productId: result.result.productId }
        }
      }),
      new Action({
        name: `保存bom:${productName}`,
        url: '/app/bom/saveBom',
        param: {
          productId: '${productId}',
          boms
        }
      })
    ]
  }

  private listProduct(): Action {
    return new Action({
      name: '查询餐品',
      url: '/app/product/listProduct',
      param: {}
    }, {
      buildVariable(result) {
        let content: any[] = result.result.content ?? []
        let product: any = {}
        for (let row of content) {
          product[row.name] = row.productId
        }
        return { product }
      }
    })
  }

  private inventory(name: string, day: string, rows: Array<{
    material: string
    cnt: number
    buyUnitFee: number
    cost: number
  }>): Action {
    return new Action({
      name,
      url: '/app/inventory/setInventoryByArray',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        bussinessDate: day,
        array: rows.map(row => ({
          materialId: `\${materialMap.${row.material}.materialId}`,
          cnt: row.cnt,
          buyUnitFee: row.buyUnitFee,
          cost: row.cost
        }))
      }
    })
  }

  private instockNote(name: string, day: string, noteKey: string, items: Array<{
    material: string
    supplier: string
    cnt: number
    buyUnitFee: number
    price: number
    stockBuyUnitFee: number
  }>): BaseTest[] {
    return [
      new Action({
        name: `${name}下单`,
        url: '/app/note/createNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          items: items.map(row => ({
            materialId: `\${materialMap.${row.material}.materialId}`,
            supplierId: `\${supplierMap.${row.supplier}}`,
            cnt: row.cnt,
            buyUnitFee: row.buyUnitFee,
            price: row.price,
            stockBuyUnitFee: row.stockBuyUnitFee
          }))
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result ?? []
          return {
            noteIds: content.map(row => row.noteId),
            [noteKey]: content[0]
          }
        }
      }),
      new Action({
        name: `${name}发送`,
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }),
      new Action({
        name: `${name}入库`,
        url: '/app/note/processNote',
        param: {
          noteId: `\${${noteKey}.noteId}`,
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(ret: any, variable: any) {
          let noteItems: any[] = variable[noteKey].noteItems ?? []
          ret.noteItems = noteItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            cnt: row.cnt,
            instockCnt: row.cnt,
            price: row.price,
            stockBuyUnitFee: row.stockBuyUnitFee,
            materialId: row.materialId,
            yieldRate: 0
          }))
          return ret
        }
      }),
      new Action({
        name: `${name}改到${day}`,
        url: '/app/note/updateNoteTime',
        param: {
          noteId: `\${${noteKey}.noteId}`,
          sysAddTime: `${day} 00:00:00`,
          lastUpdateTime: `${day} 00:00:00`,
          warehouseId: '${warehouse.warehouseId}'
        }
      })
    ]
  }

  private sales(productName: string, cnt: number, salesDate: string): Action {
    return new Action({
      name: `销售:${productName}${cnt}份`,
      url: '/app/salesRecord/addSalesRecord',
      param: {
        productId: `\${product.${productName}}`,
        cnt,
        salesDate,
        warehouseId: '${warehouse.warehouseId}'
      }
    })
  }

  private listNoteItems(noteKey: string, saveAs: string): Action {
    return new Action({
      name: `查询${noteKey}明细`,
      url: '/app/noteItem/listNoteItem',
      param: { noteId: `\${${noteKey}.noteId}` }
    }, {
      buildVariable(result) {
        return { [saveAs]: result.result.content ?? [] }
      }
    })
  }

  private backSep4(): BaseTest[] {
    return [
      new Action({
        name: '9月4日退货',
        remark: '羊肉1包、白菜2斤、萝卜3斤，单价沿用9月2日订单',
        url: '/app/noteBack/createNoteBack',
        param: { warehouseId: '${warehouse.warehouseId}' }
      }, {
        parseHttpParam(ret: any, variable: any) {
          let rows = [...(variable.sep2Items1 ?? []), ...(variable.sep2Items2 ?? [])]
          let want: any = {}
          want[String(variable.materialMap.羊肉.materialId)] = 1
          want[String(variable.materialMap.白菜.materialId)] = 2
          want[String(variable.materialMap.萝卜.materialId)] = 3
          ret.items = rows.filter(row => want[String(row.materialId)] != null).map(row => ({
            noteItemId: row.noteItemId,
            stockUnitsId: row.stockUnitsId,
            cnt: want[String(row.materialId)],
            buyUnitFee: 1,
            price: row.price,
            supplierId: row.supplierId,
            materialId: row.materialId,
            stockBuyUnitFee: row.stockBuyUnitFee,
            remark: '9月4日退货'
          }))
          return ret
        }
      }),
      new Action({
        name: '查询退货单',
        url: '/app/note/listNote',
        param: {
          status: 'instocked',
          type: 'back',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content ?? []
          return {
            backNoteId: content[0]?.noteId,
            backNoteId2: content[1]?.noteId
          }
        }
      }),
      this.updateNoteTime('退货单', '${backNoteId}', '2026-09-04'),
      new Action({
        name: '退货单2改到2026-09-04',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${backNoteId2}',
          sysAddTime: '2026-09-04 00:00:00',
          lastUpdateTime: '2026-09-04 00:00:00',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        needRunVariable: { key: 'backNoteId2' }
      })
    ]
  }

  private updateNoteTime(name: string, noteId: string, day: string): Action {
    return new Action({
      name: `${name}改到${day}`,
      url: '/app/note/updateNoteTime',
      param: {
        noteId,
        sysAddTime: `${day} 00:00:00`,
        lastUpdateTime: `${day} 00:00:00`,
        warehouseId: '${warehouse.warehouseId}'
      }
    })
  }

  private otherUseSep6(): BaseTest[] {
    return [
      new Action({
        name: '查询报损类型',
        url: '/app/otherType/listOtherType',
        param: { isAdd: 0 }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content ?? []
          let row = content.find(item => item.name == '报损') ?? content[0]
          return { lossTypeId: row?.otherTypeId }
        }
      }),
      new Action({
        name: '9月6日报损',
        remark: '白菜5斤、萝卜4斤',
        url: '/app/otherUse/saveOtherUse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${lossTypeId}',
          isAdd: 0,
          remark: '9月6日报损',
          createTime: '2026-09-06',
          otherItems: [
            { materialId: '${materialMap.白菜.materialId}', cnt: 5, buyUnitFee: 1 },
            { materialId: '${materialMap.萝卜.materialId}', cnt: 4, buyUnitFee: 1 }
          ]
        }
      })
    ]
  }

  private otherInstockSep6(): BaseTest[] {
    return [
      new Action({
        name: '查询其他入库类型',
        url: '/app/otherType/listOtherType',
        param: { isAdd: 1 }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content ?? []
          let row = content.find(item => item.name == '赠予') ?? content[0]
          return { otherInstockTypeId: row?.otherTypeId }
        }
      }),
      new Action({
        name: '9月6日其他入库',
        remark: '牛肉10包，50元/包，金额500',
        url: '/app/otherUse/saveOtherUse',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          openTypeId: '${otherInstockTypeId}',
          isAdd: 1,
          remark: '9月6日其他入库',
          createTime: '2026-09-06',
          otherItems: [{
            materialId: '${materialMap.牛肉.materialId}',
            cnt: 10,
            buyUnitFee: 1,
            price: 50,
            stockBuyUnitFee: 1
          }]
        }
      })
    ]
  }

  private checkState(opt: {
    name: string
    begin: string
    end: string
    data: {
      beginAmount: number
      instockAmount: number
      endAmount: number
      amount: number
      costOfTheory: number
      endAmountOfTheory: number
      otherUseAmount: number
      cost: number
      costDiff: number
    }
    info: {
      hasBeginInventory: boolean
      afterBeginInventoryDay: string
      hasEndInventory: boolean
      noPrice: boolean
      noSales: boolean
      noBom: boolean
      noOtherUse: boolean
      noOtherInstock: boolean
    }
  }): Action {
    return new Action({
      name: opt.name,
      url: '/app/state2/stateWarehouse',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: opt.begin,
        end: opt.end
      }
    }, {
      check(result) {
        let data = result.result.data
        let info = result.result.info
        CheckUtil.expectEqual(Number(data.beginAmount), opt.data.beginAmount, `${opt.name}期初`)
        CheckUtil.expectEqual(Number(data.instockAmount), opt.data.instockAmount, `${opt.name}入库`)
        CheckUtil.expectEqual(Number(data.endAmount), opt.data.endAmount, `${opt.name}期末`)
        CheckUtil.expectEqual(Number(data.amount), opt.data.amount, `${opt.name}实际消耗`)
        CheckUtil.expectEqual(Number(data.costOfTheory), opt.data.costOfTheory, `${opt.name}理论消耗`)
        CheckUtil.expectEqual(Number(data.endAmountOfTheory), opt.data.endAmountOfTheory, `${opt.name}理论期末`)
        CheckUtil.expectEqual(Number(data.otherUseAmount), opt.data.otherUseAmount, `${opt.name}其他耗用`)
        CheckUtil.expectEqual(Number(data.cost), opt.data.cost, `${opt.name}成本`)
        CheckUtil.expectEqual(Number(data.costDiff), opt.data.costDiff, `${opt.name}成本差`)
        CheckUtil.expectEqual(!!info.hasBeginInventory, opt.info.hasBeginInventory, `${opt.name}期初盘点`)
        CheckUtil.expectEqual(info.afterBeginInventoryDay ?? null, opt.info.afterBeginInventoryDay, `${opt.name}区间内盘点`)
        CheckUtil.expectEqual(!!info.hasEndInventory, opt.info.hasEndInventory, `${opt.name}结束日盘点`)
        CheckUtil.expectEqual(!!info.noPrice, opt.info.noPrice, `${opt.name}缺单价`)
        CheckUtil.expectEqual(!!info.noSales, opt.info.noSales, `${opt.name}没有销量`)
        CheckUtil.expectEqual(!!info.noBom, opt.info.noBom, `${opt.name}没配BOM`)
        CheckUtil.expectEqual(!!info.noOtherUse, opt.info.noOtherUse, `${opt.name}没有其他损耗`)
        CheckUtil.expectEqual(!!info.noOtherInstock, opt.info.noOtherInstock, `${opt.name}没有其他入库`)
      }
    })
  }

  /**
   * 各物料金额相加后再保留 2 位，要等于 stateWarehouse 的对应金额。
   */
  private checkMaterialAmount(opt: {
    name: string
    begin: string
    end: string
    notInBom?: boolean | number
    names?: string[]
    data: {
      beginAmount: number
      instockAmount: number
      endAmount: number
      amount: number
      costOfTheory: number
      endAmountOfTheory: number
      otherUseAmount: number
      cost: number
      costDiff: number
    }
  }): Action {
    let cols = [
      'beginAmount', 'instockAmount', 'endAmount', 'amount',
      'costOfTheory', 'endAmountOfTheory', 'otherUseAmount', 'cost', 'costDiff'
    ]
    let param: any = {
      warehouseId: '${warehouse.warehouseId}',
      begin: opt.begin,
      end: opt.end,
      pageSize: 100
    }
    if (opt.notInBom != null) {
      param.notInBom = opt.notInBom
    }
    return new Action({
      name: opt.name,
      url: '/app/state2/listMaterialAmount',
      param
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        CheckUtil.expectEqual(content.length > 0, true, `${opt.name}应有物料`)
        if (opt.names != null) {
          let names = content.map(row => row.name).sort().join(',')
          let expectNames = [...opt.names].sort().join(',')
          CheckUtil.expectEqual(names, expectNames, `${opt.name}物料应为${expectNames}，实际=${names}`)
        }
        for (let col of cols) {
          let sum = 0
          for (let row of content) {
            sum += Number(row[col] ?? 0)
          }
          CheckUtil.expectEqual(round2(sum), opt.data[col], `${opt.name}${col}，合计=${sum}`)
        }
      }
    })
  }

  private checkCost(opt: {
    name: string
    begin: string
    end: string
    notInBom?: boolean | number
    cost: number
  }): Action {
    let param: any = {
      warehouseId: '${warehouse.warehouseId}',
      begin: opt.begin,
      end: opt.end
    }
    if (opt.notInBom != null) {
      param.notInBom = opt.notInBom
    }
    return new Action({
      name: opt.name,
      url: '/app/state2/cost',
      param
    }, {
      check(result) {
        CheckUtil.expectEqual(Number(result.result.cost), opt.cost, `${opt.name}应为${opt.cost}`)
      }
    })
  }

  /** 9月30日盘点后的 stock：数量用采购单位，金额按最新批次回填。 */
  private checkStock(): BaseTest {
    let variable = this.getVariable()
    let expects = [
      { name: '牛肉', cnt: 1, buyUnitFee: 1, cost: 50 },
      { name: '羊肉', cnt: 1, buyUnitFee: 1, cost: 300 },
      { name: '白菜', cnt: 1, buyUnitFee: 1, cost: 200 },
      { name: '萝卜', cnt: 1, buyUnitFee: 1, cost: 100 },
      { name: '塑料杯', cnt: 4, buyUnitFee: 1, cost: 8 }
    ]
    return new CheckArray([{
      table: 'stock',
      check(array) {
        for (let expect of expects) {
          let materialId = variable.materialMap?.[expect.name]?.materialId
          let stock = array.find((row: any) => String(row.materialId) === String(materialId))
          CheckUtil.expectEqual(stock != null, true, `${expect.name}库存不存在`)
          CheckUtil.expectEqual(
            StockUtil.isEq(
              { cnt: Number(stock.cnt), buyUnitFee: Number(stock.buyUnitFee) },
              { cnt: expect.cnt, buyUnitFee: expect.buyUnitFee }
            ),
            true,
            `${expect.name}数量应为${expect.cnt}，实际 cnt=${stock?.cnt} buyUnitFee=${stock?.buyUnitFee}`
          )
          CheckUtil.expectEqual(Number(stock.cost), expect.cost, `${expect.name}金额应为${expect.cost}，实际=${stock?.cost}`)
        }
      }
    }]).setRemark('校验 stock 数量和金额')
  }
}

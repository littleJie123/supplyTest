import { BaseTest, CheckUtil, DownloadExcelAction, MultiSheetDownloadAction, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import ListMaterial from "../../action/material/ListMaterial";
import Recal from "../../action/Recal";
import CheckArray from "../../action/CheckArray";
import StockUtil from "../../util/StockUtil";

/** 与 NumUtil.toNum(n, 2) 一致。 */
function dayText(value: any): string {
  if (value == null || value === '') {
    return ''
  }
  let date: Date
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    date = new Date(Number(value))
  } else {
    date = new Date(value)
  }
  if (isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }
  let month = String(date.getMonth() + 1).padStart(2, '0')
  let day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function expectOnionLine(product: any, name: string, expect: {
  cntOfTheory: number
  cnt: number
  cost: number
  costOfTheory: number
}) {
  let line = (product?.materials ?? []).find((row: any) => row.name == '洋葱')
  CheckUtil.expectEqual(line != null, true, `${name}缺少洋葱`)
  CheckUtil.expectEqual(
    line?.buyUnit != null && line.buyUnit.length > 0,
    true,
    `${name}洋葱应有buyUnit`
  )
  CheckUtil.expectEqual(
    StockUtil.isEq(
      { cnt: Number(line?.cntOfTheory), buyUnitFee: Number(line?.buyUnitFee) },
      { cnt: expect.cntOfTheory, buyUnitFee: 500 }
    ),
    true,
    `${name}理论数量应为${expect.cntOfTheory}/500，实际${line?.cntOfTheory}/${line?.buyUnitFee}`
  )
  CheckUtil.expectEqual(
    StockUtil.isEq(
      { cnt: Number(line?.cnt), buyUnitFee: Number(line?.buyUnitFee) },
      { cnt: expect.cnt, buyUnitFee: 500 }
    ),
    true,
    `${name}实际数量应为${expect.cnt}/500，实际${line?.cnt}/${line?.buyUnitFee}`
  )
  CheckUtil.expectEqual(round2(Number(line?.cost)), round2(expect.cost), `${name}实际成本应为${expect.cost}，实际${line?.cost}`)
  CheckUtil.expectEqual(
    Number(line?.costOfTheory),
    expect.costOfTheory,
    `${name}物料理论成本应为${expect.costOfTheory}，实际${line?.costOfTheory}`
  )
  CheckUtil.expectEqual(round2(Number(product.cost)), round2(expect.cost), `${name}餐品实际成本应为${expect.cost}，实际${product.cost}`)
}

function expectMaterialLine(product: any, productName: string, materialName: string, expect: {
  cntOfTheory: number
  cnt: number
  buyUnitFee: number
  cost: number
  costOfTheory: number
}) {
  let line = (product?.materials ?? []).find((row: any) => row.name == materialName)
  CheckUtil.expectEqual(line != null, true, `${productName}缺少${materialName}`)
  CheckUtil.expectEqual(
    line?.buyUnit != null && line.buyUnit.length > 0,
    true,
    `${productName}${materialName}应有buyUnit`
  )
  CheckUtil.expectEqual(
    StockUtil.isEq(
      { cnt: Number(line?.cntOfTheory), buyUnitFee: Number(line?.buyUnitFee) },
      { cnt: expect.cntOfTheory, buyUnitFee: expect.buyUnitFee }
    ),
    true,
    `${productName}${materialName}理论数量应为${expect.cntOfTheory}/${expect.buyUnitFee}，实际${line?.cntOfTheory}/${line?.buyUnitFee}`
  )
  CheckUtil.expectEqual(
    StockUtil.isEq(
      { cnt: Number(line?.cnt), buyUnitFee: Number(line?.buyUnitFee) },
      { cnt: expect.cnt, buyUnitFee: expect.buyUnitFee }
    ),
    true,
    `${productName}${materialName}实际数量应为${expect.cnt}/${expect.buyUnitFee}，实际${line?.cnt}/${line?.buyUnitFee}`
  )
  CheckUtil.expectEqual(
    round2(Number(line?.cost)),
    round2(expect.cost),
    `${productName}${materialName}实际成本应为${expect.cost}，实际${line?.cost}`
  )
  CheckUtil.expectEqual(
    Number(line?.costOfTheory),
    expect.costOfTheory,
    `${productName}${materialName}理论成本应为${expect.costOfTheory}，实际${line?.costOfTheory}`
  )
}

function round2(num: number): number {
  let x = num * 100
  let ret = Math.round(x)
  if (Math.abs(x - (ret + 1)) < 0.001) {
    ret = ret + 1
  }
  return ret / 100
}

/** Excel 行按列核对。数字先收成 2 位，避免表格读回的浮点误差。 */
function expectExcel(row: any, title: string, expect: { [col: string]: any }) {
  CheckUtil.expectEqual(row != null, true, `缺少${title}`)
  for (let col in expect) {
    let actual = row?.[col]
    let want = expect[col]
    if (typeof want === 'number') {
      CheckUtil.expectEqual(
        round2(Number(actual)),
        round2(want),
        `${title}.${col}应为${want}，实际${actual}`
      )
    } else {
      CheckUtil.expectEqual(actual, want, `${title}.${col}应为${want}，实际${actual}`)
    }
  }
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
 * 番茄炒蛋：番茄订货价和 BOM 不同，用量与理论消耗相同；鸡蛋订货价也不同，用量少于理论消耗。比价不看退货单。
 * 9月30日盘到1，输入成本不参与库存金额，processSet 按最新批次回填。期末 牛50、羊300、白菜200、萝卜100、杯8。番茄和鸡蛋期末为 0。
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
          },
          {
            name: '番茄', category: '蔬菜', unit: '个', code: 'MAT_TOMATO',
            suppliers: [{ isDef: true, supplierId: '${supplierMap.供应商1}', price: 10 }]
          },
          {
            name: '鸡蛋', category: '蛋类', unit: '个', code: 'MAT_EGG',
            suppliers: [{ isDef: true, supplierId: '${supplierMap.供应商2}', price: 8 }]
          },
          {
            name: '洋葱', category: '蔬菜', unit: '斤', code: 'MAT_ONION',
            suppliers: [{ isDef: true, supplierId: '${supplierMap.供应商1}', price: 10 }]
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
      this.saveBuyUnit('番茄', [
        { name: '个', fee: 1, isSupplier: true }
      ], '个'),
      this.saveBuyUnit('鸡蛋', [
        { name: '个', fee: 1, isSupplier: true }
      ], '个'),
      this.saveBuyUnit('洋葱', [
        { name: '克', fee: 1 },
        { name: '斤', fee: 500, isSupplier: true }
      ], '斤'),
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
      ...this.saveProduct('番茄炒蛋', [
        { material: '番茄', cnt: 2, buyUnitFee: 1, price: 10, stockBuyUnitFee: 1 },
        { material: '鸡蛋', cnt: 3, buyUnitFee: 1, price: 8, stockBuyUnitFee: 1 }
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
      ...this.instockNote('9月2日番茄', '2026-09-02', 'sep2Tomato', [
        { material: '番茄', supplier: '供应商1', cnt: 20, buyUnitFee: 1, price: 12, stockBuyUnitFee: 1 }
      ]),
      ...this.instockNote('9月2日鸡蛋', '2026-09-02', 'sep2Egg', [
        { material: '鸡蛋', supplier: '供应商2', cnt: 10, buyUnitFee: 1, price: 6, stockBuyUnitFee: 1 }
      ]),

      this.sales('羊肉炒白菜', 100, '2026-09-03'),
      this.sales('红烧牛肉', 80, '2026-09-03'),
      this.sales('萝卜煮羊肉', 60, '2026-09-03'),
      this.sales('清炒萝卜', 20, '2026-09-03'),
      this.sales('番茄炒蛋', 10, '2026-09-03'),

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
          instockAmount: 15820,
          endAmount: 658,
          amount: 21662,
          costOfTheory: 10168,
          endAmountOfTheory: 12152,
          otherUseAmount: 700,
          cost: 20962,
          costDiff: 10794
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
          instockAmount: 15300,
          endAmount: 13860,
          amount: 7940,
          costOfTheory: 10168,
          endAmountOfTheory: 11632,
          otherUseAmount: 0,
          cost: 7940,
          costDiff: -2228
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
          instockAmount: 5800,
          endAmount: 12300,
          amount: 0,
          costOfTheory: 0,
          endAmountOfTheory: 12300,
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
        cost: 20962
      }),
      this.checkCost({
        name: '成本9月销售BOM内',
        begin: '2026-09-01',
        end: '2026-09-30',
        notInBom: false,
        cost: 20950
      }),
      this.checkCost({
        name: '成本9月销售BOM内0',
        begin: '2026-09-01',
        end: '2026-09-30',
        notInBom: 0,
        cost: 20950
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
          instockAmount: 15820,
          endAmount: 658,
          amount: 21662,
          costOfTheory: 10168,
          endAmountOfTheory: 12152,
          otherUseAmount: 700,
          cost: 20962,
          costDiff: 10794
        }
      }),
      this.checkMaterialAmount({
        name: '物料成本9月1日到9月5日',
        begin: '2026-09-01',
        end: '2026-09-05',
        data: {
          beginAmount: 6500,
          instockAmount: 15300,
          endAmount: 13860,
          amount: 7940,
          costOfTheory: 10168,
          endAmountOfTheory: 11632,
          otherUseAmount: 0,
          cost: 7940,
          costDiff: -2228
        }
      }),
      this.checkMaterialAmount({
        name: '物料成本9月1日到9月2日',
        begin: '2026-09-01',
        end: '2026-09-02',
        data: {
          beginAmount: 6500,
          instockAmount: 5800,
          endAmount: 12300,
          amount: 0,
          costOfTheory: 0,
          endAmountOfTheory: 12300,
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
      }),
      this.checkMaterialPage({
        name: '物料成本9月第1页',
        names: ['牛肉', '羊肉']
      }),
      this.checkMaterialPage({
        name: '物料成本9月第2页',
        first: 2,
        names: ['白菜', '萝卜']
      }),
      this.checkMaterialPage({
        name: '物料成本9月第3页',
        first: 4,
        names: ['番茄', '鸡蛋']
      }),
      this.checkCostDiff({
        name: '差异9月1日到9月2日',
        begin: '2026-09-01',
        end: '2026-09-02',
        priceDiffCnt: 0,
        cntDiffCnt: 0
      }),
      this.checkCostDiff({
        name: '差异9月1日到9月5日',
        begin: '2026-09-01',
        end: '2026-09-05',
        priceDiffCnt: 6,
        cntDiffCnt: 3
      }),
      this.checkCostDiff({
        name: '差异9月',
        begin: '2026-09-01',
        end: '2026-09-30',
        priceDiffCnt: 6,
        cntDiffCnt: 5
      }),
      this.checkMaterialFilter({
        name: '单价不一致9月',
        inPriceDiff: true,
        names: ['牛肉', '羊肉', '白菜', '萝卜', '番茄', '鸡蛋']
      }),
      this.checkMaterialFilter({
        name: '单价一致9月',
        inPriceDiff: false,
        names: ['塑料杯']
      }),
      this.checkMaterialFilter({
        name: '数量不一致9月',
        inCntDiff: true,
        names: ['牛肉', '羊肉', '白菜', '萝卜', '鸡蛋', '塑料杯']
      }),
      this.checkMaterialFilter({
        name: '数量一致9月',
        inCntDiff: false,
        names: ['番茄']
      }),
      this.checkMaterialFilter({
        name: '单价和数量都不一致9月',
        inPriceDiff: true,
        inCntDiff: true,
        names: ['牛肉', '羊肉', '白菜', '萝卜', '鸡蛋']
      }),
      this.checkMaterialFilter({
        name: '单价和数量都一致9月',
        inPriceDiff: false,
        inCntDiff: false,
        names: []
      }),
      this.checkMaterialFilter({
        name: '单价不一致9月第1页',
        inPriceDiff: true,
        pageSize: 2,
        names: ['牛肉', '羊肉']
      }),
      this.checkMaterialFilter({
        name: '单价不一致9月第2页',
        inPriceDiff: true,
        pageSize: 2,
        first: 2,
        names: ['白菜', '萝卜']
      }),
      this.checkMaterialFilter({
        name: '单价不一致9月1日到9月2日',
        begin: '2026-09-01',
        end: '2026-09-02',
        inPriceDiff: true,
        names: []
      }),
      this.checkMaterialFilter({
        name: '单价一致9月1日到9月2日',
        begin: '2026-09-01',
        end: '2026-09-02',
        inPriceDiff: false,
        ordered: false,
        names: ['牛肉', '羊肉', '白菜', '萝卜', '番茄', '鸡蛋']
      }),
      this.checkProductCnt({
        name: '餐品数9月',
        counts: {
          '牛肉': 1,
          '羊肉': 2,
          '白菜': 1,
          '萝卜': 1,
          '番茄': 1,
          '鸡蛋': 1,
          '塑料杯': 0
        }
      }),
      this.checkProductCnt({
        name: '餐品数9月1日到9月2日',
        begin: '2026-09-01',
        end: '2026-09-02',
        counts: {
          '牛肉': 0,
          '羊肉': 0,
          '白菜': 0,
          '萝卜': 0,
          '番茄': 0,
          '鸡蛋': 0
        }
      }),
      this.checkProductCnt({
        name: '不需要餐品数',
        need: false,
        pageSize: 2,
        names: ['牛肉', '羊肉']
      }),
      this.checkInstocks({
        name: '入库明细第1页',
        pageSize: 2,
        rows: [
          {
            name: '牛肉',
            instocks: [
              { day: '2026-09-01', type: 'Instock', cnt: 50, buyUnitFee: 100, price: 0, stockBuyUnitFee: 1 },
              { day: '2026-09-02', type: 'Instock', cnt: 10, buyUnitFee: 1, price: 200, stockBuyUnitFee: 1 },
              { day: '2026-09-05', type: 'Instock', cnt: 10, buyUnitFee: 1, price: 400, stockBuyUnitFee: 1 },
              { day: '2026-09-06', type: 'otherInstock', cnt: 10, buyUnitFee: 1, price: 50, stockBuyUnitFee: 1 }
            ]
          },
          {
            name: '羊肉',
            instocks: [
              { day: '2026-09-01', type: 'Instock', cnt: 10, buyUnitFee: 100, price: 0, stockBuyUnitFee: 1 },
              { day: '2026-09-02', type: 'Instock', cnt: 11, buyUnitFee: 1, price: 150, stockBuyUnitFee: 1 },
              { day: '2026-09-05', type: 'Instock', cnt: 10, buyUnitFee: 1, price: 300, stockBuyUnitFee: 1 }
            ]
          }
        ]
      }),
      this.checkInstocks({
        name: '入库明细第2页不含退货',
        pageSize: 2,
        first: 2,
        rows: [
          {
            name: '白菜',
            instocks: [
              { day: '2026-09-02', type: 'Instock', cnt: 12, buyUnitFee: 1, price: 100, stockBuyUnitFee: 1 },
              { day: '2026-09-05', type: 'Instock', cnt: 10, buyUnitFee: 1, price: 200, stockBuyUnitFee: 1 }
            ]
          },
          {
            name: '萝卜',
            instocks: [
              { day: '2026-09-02', type: 'Instock', cnt: 13, buyUnitFee: 1, price: 50, stockBuyUnitFee: 1 },
              { day: '2026-09-05', type: 'Instock', cnt: 10, buyUnitFee: 1, price: 100, stockBuyUnitFee: 1 }
            ]
          }
        ]
      }),
      this.checkInstocks({
        name: '塑料杯入库明细',
        notInBom: true,
        rows: [{
          name: '塑料杯',
          instocks: [
            { day: '2026-09-07', type: 'Instock', cnt: 10, buyUnitFee: 1, price: 2, stockBuyUnitFee: 1 }
          ]
        }]
      }),
      this.saveBeefInstockIds(),
      new Action({
        name: '只改牛肉9月5日入库单价',
        url: '/app/state2/updateStockRecord',
        param: {
          array: [
            {
              stockRecordId: '${beefSep5Id}',
              price: 500,
              stockBuyUnitFee: 1
            },
            {
              stockRecordId: '${beefSep2Id}',
              price: 200,
              stockBuyUnitFee: 1
            }
          ]
        }
      }),
      new Action({
        name: '只改塑料杯入库数量',
        url: '/app/state2/updateStockRecord',
        param: {
          array: [{
            stockRecordId: '${cupSep7Id}',
            cnt: 8,
            buyUnitFee: 1
          }]
        }
      }),
      this.checkInstocks({
        name: '牛肉入库单价已改',
        pageSize: 2,
        rows: [
          {
            name: '牛肉',
            instocks: [
              { day: '2026-09-01', type: 'Instock', cnt: 50, buyUnitFee: 100, price: 0, stockBuyUnitFee: 1 },
              { day: '2026-09-02', type: 'Instock', cnt: 10, buyUnitFee: 1, price: 200, stockBuyUnitFee: 1 },
              { day: '2026-09-05', type: 'Instock', cnt: 10, buyUnitFee: 1, price: 500, stockBuyUnitFee: 1 },
              { day: '2026-09-06', type: 'otherInstock', cnt: 10, buyUnitFee: 1, price: 50, stockBuyUnitFee: 1 }
            ]
          },
          {
            name: '羊肉',
            instocks: [
              { day: '2026-09-01', type: 'Instock', cnt: 10, buyUnitFee: 100, price: 0, stockBuyUnitFee: 1 },
              { day: '2026-09-02', type: 'Instock', cnt: 11, buyUnitFee: 1, price: 150, stockBuyUnitFee: 1 },
              { day: '2026-09-05', type: 'Instock', cnt: 10, buyUnitFee: 1, price: 300, stockBuyUnitFee: 1 }
            ]
          }
        ]
      }),
      this.checkInstocks({
        name: '塑料杯入库数量已改',
        notInBom: true,
        rows: [{
          name: '塑料杯',
          instocks: [
            { day: '2026-09-07', type: 'Instock', cnt: 8, buyUnitFee: 1, price: 2, stockBuyUnitFee: 1 }
          ]
        }]
      }),
      new Action({
        name: '同时改羊肉订货和牛肉其他入库',
        url: '/app/state2/updateStockRecord',
        param: {
          array: [
            {
              stockRecordId: '${lambSep5Id}',
              cnt: 8,
              buyUnitFee: 1,
              price: 360,
              stockBuyUnitFee: 1
            },
            {
              stockRecordId: '${beefOtherId}',
              cnt: 6,
              buyUnitFee: 1,
              price: 40,
              stockBuyUnitFee: 1
            }
          ]
        }
      }),
      this.checkNoteItemChanged(),
      this.checkOtherItemChanged(),
      new Recal(),
      this.checkStock({ '牛肉': 40, '羊肉': 360 }),
      this.checkState({
        name: '改价改数量后统计9月',
        begin: '2026-09-01',
        end: '2026-09-30',
        data: {
          beginAmount: 6500,
          instockAmount: 16436,
          endAmount: 708,
          amount: 22228,
          costOfTheory: 10168,
          endAmountOfTheory: 12768,
          otherUseAmount: 700,
          cost: 21528,
          costDiff: 11360
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
      ...this.onionProducts(),
      this.checkSalesRecordPeriod(),
      this.checkAllProductAmount(),
      this.checkBeefProductAmount(),
      this.checkMaterialExcel(),
      this.checkProductExcel(),
      this.checkPsiExcel(),
      ...this.checkStoreNoteTime()
    ]
  }

  /**
   * 洋葱 1斤=500克。按斤、按克各一个餐品。
   * 入库 10斤×10元后把 9月30日盘成 0，实际消耗 10斤、100元。
   * 理论是 2斤和 400克。format 后 buyUnitFee=500，一次分摊 3571 和 1428，剩余 1 给 productId 较小的餐品。
   */
  private onionProducts(): BaseTest[] {
    return [
      ...this.saveProduct('洋葱按斤', [
        { material: '洋葱', cnt: 1, buyUnitFee: 1, price: 10, stockBuyUnitFee: 1 }
      ]),
      ...this.saveProduct('洋葱按克', [
        { material: '洋葱', cnt: 100, buyUnitFee: 500, price: 10, stockBuyUnitFee: 1 }
      ]),
      this.listProduct(),
      ...this.instockNote('9月8日洋葱', '2026-09-08', 'onionNote', [
        { material: '洋葱', supplier: '供应商1', cnt: 10, buyUnitFee: 1, price: 10, stockBuyUnitFee: 1 }
      ]),
      this.sales('洋葱按斤', 2, '2026-09-09'),
      this.sales('洋葱按克', 4, '2026-09-09'),
      this.inventory('洋葱9月30日盘成0', '2026-09-30', [
        { material: '洋葱', cnt: 0, buyUnitFee: 1, cost: 0 }
      ]),
      new Recal(),
      this.checkOnionShare(),
      this.checkOnionPage(0, '洋葱按斤'),
      this.checkOnionPage(1, '洋葱按克')
    ]
  }

  /**
   * begin、end 都含当天。查 9月9日只能看到洋葱两笔，9月3日的五笔不在里面。
   */
  private checkSalesRecordPeriod(): Action {
    return new Action({
      name: '销售记录按日期',
      url: '/app/salesRecord/listSalesRecord',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: '2026-09-09',
        end: '2026-09-09',
        pageSize: 20
      }
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        CheckUtil.expectEqual(content.length, 2, `9月9日销售应为2笔，实际${content.length}`)
        let expectRows = [
          { name: '洋葱按斤', cnt: 2 },
          { name: '洋葱按克', cnt: 4 }
        ]
        for (let expectRow of expectRows) {
          let row = content.find(item => item?.product?.name == expectRow.name)
          CheckUtil.expectEqual(row != null, true, `9月9日缺少${expectRow.name}`)
          CheckUtil.expectEqual(Number(row?.cnt), expectRow.cnt, `${expectRow.name}销量应为${expectRow.cnt}，实际${row?.cnt}`)
          let day = String(row?.salesDate ?? '').substring(0, 10)
          CheckUtil.expectEqual(day, '2026-09-09', `${expectRow.name}销售日期应为2026-09-09，实际${row?.salesDate}`)
        }
        let early = content.find(item => String(item?.salesDate ?? '').substring(0, 10) < '2026-09-09')
        CheckUtil.expectEqual(early == null, true, `不应查出9月9日之前的销售，实际${early?.product?.name}`)
      }
    })
  }

  /**
   * 不带 materialId。塑料杯没有销售 BOM，不出现。
   * 清炒萝卜没有 BOM，实际成本 0。
   * 羊肉实际 27.1包、5520元，按理论 10包、18包 分，剩余给 productId 较小的餐品。
   */
  private checkAllProductAmount(): Action {
    let variable = this.getVariable()
    return new Action({
      name: '全部餐品成本',
      url: '/app/state2/listProductAmount',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: '2026-09-01',
        end: '2026-09-30',
        pageSize: 20,
        _needCnt: true
      }
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        let fryId = Number(variable.product?.['羊肉炒白菜'])
        let stewId = Number(variable.product?.['萝卜煮羊肉'])
        let jinId = Number(variable.product?.['洋葱按斤'])
        let gramId = Number(variable.product?.['洋葱按克'])
        let fryExtra = fryId < stewId
        let jinExtra = jinId < gramId
        let lambFryCost = (197142 + (fryExtra ? 1 : 0)) / 100
        let lambStewCost = (354857 + (fryExtra ? 0 : 1)) / 100
        let jinCost = (7142 + (jinExtra ? 1 : 0)) / 100
        let gramCost = (2857 + (jinExtra ? 0 : 1)) / 100
        let expectRows = [
          { name: '红烧牛肉', cnt: 80, costOfTheory: 5760, cost: 9200 },
          { name: '羊肉炒白菜', cnt: 100, costOfTheory: 1520, cost: 4300 + lambFryCost },
          { name: '萝卜煮羊肉', cnt: 60, costOfTheory: 2448, cost: 2200 + lambStewCost },
          { name: '番茄炒蛋', cnt: 10, costOfTheory: 440, cost: 300 },
          { name: '洋葱按斤', cnt: 2, costOfTheory: 20, cost: jinCost },
          { name: '洋葱按克', cnt: 4, costOfTheory: 8, cost: gramCost },
          { name: '清炒萝卜', cnt: 20, costOfTheory: 0, cost: 0 }
        ]
        CheckUtil.expectEqual(content.length, expectRows.length, `餐品应为${expectRows.length}个，实际${content.length}`)
        CheckUtil.expectEqual(
          Number(result.result?.totalElements),
          expectRows.length,
          `餐品总数应为${expectRows.length}，实际${result.result?.totalElements}`
        )
        let names = content.map(row => row.name).join(',')
        let expectNames = expectRows.map(row => row.name).join(',')
        CheckUtil.expectEqual(names, expectNames, `应按实际成本倒序，实际${names}`)
        for (let expectRow of expectRows) {
          let row = content.find(item => item.name == expectRow.name)
          CheckUtil.expectEqual(Number(row?.cnt), expectRow.cnt, `${expectRow.name}销量应为${expectRow.cnt}，实际${row?.cnt}`)
          CheckUtil.expectEqual(
            Number(row?.costOfTheory),
            expectRow.costOfTheory,
            `${expectRow.name}理论成本应为${expectRow.costOfTheory}，实际${row?.costOfTheory}`
          )
          CheckUtil.expectEqual(
            round2(Number(row?.cost)),
            round2(expectRow.cost),
            `${expectRow.name}实际成本应为${expectRow.cost}，实际${row?.cost}`
          )
        }
        let fry = content.find(row => row.name == '羊肉炒白菜')
        let stew = content.find(row => row.name == '萝卜煮羊肉')
        let beefDish = content.find(row => row.name == '红烧牛肉')
        let eggDish = content.find(row => row.name == '番茄炒蛋')
        let plain = content.find(row => row.name == '清炒萝卜')
        CheckUtil.expectEqual((fry?.materials ?? []).length, 2, `羊肉炒白菜物料数应为2，实际${fry?.materials?.length}`)
        CheckUtil.expectEqual((stew?.materials ?? []).length, 2, `萝卜煮羊肉物料数应为2，实际${stew?.materials?.length}`)
        CheckUtil.expectEqual((beefDish?.materials ?? []).length, 1, `红烧牛肉物料数应为1，实际${beefDish?.materials?.length}`)
        CheckUtil.expectEqual((eggDish?.materials ?? []).length, 2, `番茄炒蛋物料数应为2，实际${eggDish?.materials?.length}`)
        CheckUtil.expectEqual((plain?.materials ?? []).length, 0, `清炒萝卜不应有物料，实际${plain?.materials?.length}`)
        expectMaterialLine(beefDish, '红烧牛肉', '牛肉', {
          cntOfTheory: 2400, cnt: 3550, buyUnitFee: 100, cost: 9200, costOfTheory: 5760
        })
        expectMaterialLine(fry, '羊肉炒白菜', '羊肉', {
          cntOfTheory: 1000,
          cnt: 967 + (fryExtra ? 1 : 0),
          buyUnitFee: 100,
          cost: lambFryCost,
          costOfTheory: 1200
        })
        expectMaterialLine(fry, '羊肉炒白菜', '白菜', {
          cntOfTheory: 2000, cnt: 17000, buyUnitFee: 500, cost: 4300, costOfTheory: 320
        })
        expectMaterialLine(stew, '萝卜煮羊肉', '羊肉', {
          cntOfTheory: 1800,
          cnt: 1742 + (fryExtra ? 0 : 1),
          buyUnitFee: 100,
          cost: lambStewCost,
          costOfTheory: 2160
        })
        expectMaterialLine(stew, '萝卜煮羊肉', '萝卜', {
          cntOfTheory: 2400, cnt: 17500, buyUnitFee: 500, cost: 2200, costOfTheory: 288
        })
        expectMaterialLine(eggDish, '番茄炒蛋', '番茄', {
          cntOfTheory: 20, cnt: 20, buyUnitFee: 1, cost: 240, costOfTheory: 200
        })
        expectMaterialLine(eggDish, '番茄炒蛋', '鸡蛋', {
          cntOfTheory: 30, cnt: 10, buyUnitFee: 1, cost: 60, costOfTheory: 240
        })
        let jin = content.find(row => row.name == '洋葱按斤')
        let gram = content.find(row => row.name == '洋葱按克')
        expectMaterialLine(jin, '洋葱按斤', '洋葱', {
          cntOfTheory: 1000,
          cnt: 3571 + (jinExtra ? 1 : 0),
          buyUnitFee: 500,
          cost: jinCost,
          costOfTheory: 20
        })
        expectMaterialLine(gram, '洋葱按克', '洋葱', {
          cntOfTheory: 400,
          cnt: 1428 + (jinExtra ? 0 : 1),
          buyUnitFee: 500,
          cost: gramCost,
          costOfTheory: 8
        })
        for (let row of content) {
          let cup = (row.materials ?? []).find((item: any) => item.name == '塑料杯')
          CheckUtil.expectEqual(cup == null, true, `${row.name}不应出现塑料杯`)
        }
      }
    })
  }

  /** 只返回用到牛肉的餐品。牛肉做二次分摊，这里只有红烧牛肉。 */
  private checkBeefProductAmount(): Action {
    return new Action({
      name: '牛肉餐品成本',
      url: '/app/state2/listProductAmount',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: '2026-09-01',
        end: '2026-09-30',
        materialId: '${materialMap.牛肉.materialId}',
        pageSize: 20,
        _needCnt: true
      }
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        CheckUtil.expectEqual(content.length, 1, `用到牛肉的餐品应为1个，实际${content.length}`)
        CheckUtil.expectEqual(
          Number(result.result?.totalElements),
          1,
          `用到牛肉的餐品总数应为1，实际${result.result?.totalElements}`
        )
        CheckUtil.expectEqual(content[0]?.name, '红烧牛肉', `应为红烧牛肉，实际${content[0]?.name}`)
        CheckUtil.expectEqual(Number(content[0]?.cnt), 80, `红烧牛肉销量应为80，实际${content[0]?.cnt}`)
        CheckUtil.expectEqual(
          Number(content[0]?.costOfTheory),
          5760,
          `红烧牛肉理论成本应为5760，实际${content[0]?.costOfTheory}`
        )
        CheckUtil.expectEqual(
          round2(Number(content[0]?.cost)),
          9200,
          `红烧牛肉实际成本应为9200，实际${content[0]?.cost}`
        )
        CheckUtil.expectEqual(
          (content[0]?.materials ?? []).length,
          1,
          `红烧牛肉物料数应为1，实际${content[0]?.materials?.length}`
        )
        expectMaterialLine(content[0], '红烧牛肉', '牛肉', {
          cntOfTheory: 2400, cnt: 3550, buyUnitFee: 100, cost: 9200, costOfTheory: 5760
        })
      }
    })
  }

  /**
   * 物料统计下载。数量是「几包几克」，出库是实际消耗（没扣其他耗用），实际成本才扣其他耗用。
   */
  private checkMaterialExcel(): DownloadExcelAction {
    let expects: { [name: string]: any } = {
      牛肉: {
        '物料编码': 'MAT_BEEF', '单位': '克', '使用频次': 1,
        '理论成本[数量]': '24包', '实际成本[数量]': '35包50克', '差异数量': '11包50克',
        '数量差异率': '47.92%',
        '理论成本[金额]': 5760, '实际成本[金额]': 9200, '差异金额': 3440, '金额差异率': '59.72%',
        '期初数量': '10包', '入库数量': '26包50克', '出库数量': '35包50克', '期末数量': '1包',
        '期初金额': 2000, '入库金额': 7240, '出库金额': 9200, '期末金额': 40
      },
      羊肉: {
        '物料编码': 'MAT_LAMB', '单位': '克', '使用频次': 2,
        '理论成本[数量]': '28包', '实际成本[数量]': '27包10克', '差异数量': '-90克',
        '数量差异率': '-3.21%',
        '理论成本[金额]': 3360, '实际成本[金额]': 5520, '差异金额': 2160, '金额差异率': '64.29%',
        '期初数量': '10包', '入库数量': '18包10克', '出库数量': '27包10克', '期末数量': '1包',
        '期初金额': 1500, '入库金额': 4380, '出库金额': 5520, '期末金额': 360
      },
      白菜: {
        '物料编码': 'MAT_CABBAGE', '单位': '克', '使用频次': 1,
        '理论成本[数量]': '4斤', '实际成本[数量]': '34斤', '差异数量': '30斤',
        '数量差异率': '750%',
        '理论成本[金额]': 320, '实际成本[金额]': 4300, '差异金额': 3980, '金额差异率': '1243.75%',
        '期初数量': '20斤', '入库数量': '20斤', '出库数量': '39斤', '期末数量': '1斤',
        '期初金额': 2000, '入库金额': 3000, '出库金额': 4800, '期末金额': 200
      },
      萝卜: {
        '物料编码': 'MAT_RADISH', '单位': '克', '使用频次': 1,
        '理论成本[数量]': '4斤400克', '实际成本[数量]': '35斤', '差异数量': '30斤100克',
        '数量差异率': '629.17%',
        '理论成本[金额]': 288, '实际成本[金额]': 2200, '差异金额': 1912, '金额差异率': '663.89%',
        '期初数量': '20斤', '入库数量': '20斤', '出库数量': '39斤', '期末数量': '1斤',
        '期初金额': 1000, '入库金额': 1500, '出库金额': 2400, '期末金额': 100
      },
      塑料杯: {
        '物料编码': 'MAT_CUP', '单位': '个', '使用频次': 0,
        '理论成本[数量]': '0个', '实际成本[数量]': '4个', '差异数量': '4个',
        '数量差异率': '100%',
        '理论成本[金额]': 0, '实际成本[金额]': 8, '差异金额': 8, '金额差异率': '100%',
        '期初数量': '0个', '入库数量': '8个', '出库数量': '4个', '期末数量': '4个',
        '期初金额': 0, '入库金额': 16, '出库金额': 8, '期末金额': 8
      },
      番茄: {
        '物料编码': 'MAT_TOMATO', '单位': '个', '使用频次': 1,
        '理论成本[数量]': '20个', '实际成本[数量]': '20个', '差异数量': '0个',
        '数量差异率': '0%',
        '理论成本[金额]': 200, '实际成本[金额]': 240, '差异金额': 40, '金额差异率': '20%',
        '期初数量': '0个', '入库数量': '20个', '出库数量': '20个', '期末数量': '0个',
        '期初金额': 0, '入库金额': 240, '出库金额': 240, '期末金额': 0
      },
      鸡蛋: {
        '物料编码': 'MAT_EGG', '单位': '个', '使用频次': 1,
        '理论成本[数量]': '30个', '实际成本[数量]': '10个', '差异数量': '-20个',
        '数量差异率': '-66.67%',
        '理论成本[金额]': 240, '实际成本[金额]': 60, '差异金额': -180, '金额差异率': '-75%',
        '期初数量': '0个', '入库数量': '10个', '出库数量': '10个', '期末数量': '0个',
        '期初金额': 0, '入库金额': 60, '出库金额': 60, '期末金额': 0
      },
      洋葱: {
        '物料编码': 'MAT_ONION', '单位': '克', '使用频次': 2,
        '理论成本[数量]': '2斤400克', '实际成本[数量]': '10斤', '差异数量': '7斤100克',
        '数量差异率': '257.14%',
        '理论成本[金额]': 28, '实际成本[金额]': 100, '差异金额': 72, '金额差异率': '257.14%',
        '期初数量': '0克', '入库数量': '10斤', '出库数量': '10斤', '期末数量': '0克',
        '期初金额': 0, '入库金额': 100, '出库金额': 100, '期末金额': 0
      }
    }
    let names = ['牛肉', '羊肉', '白菜', '萝卜', '塑料杯', '番茄', '鸡蛋', '洋葱']
    return new DownloadExcelAction({
      name: '物料统计下载',
      url: '/app/state/stateByMaterial',
      param: {
        begin: '2026-09-01',
        end: '2026-09-30',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(rows: any[]) {
        CheckUtil.expectEqual(rows.length, names.length + 1, `物料统计应为${names.length}行加汇总，实际${rows.length}`)
        let got = rows.filter(row => row['物料名称'] != '汇总').map(row => row['物料名称']).join(',')
        CheckUtil.expectEqual(got, names.join(','), `应按物料创建顺序，实际${got}`)
        for (let name of names) {
          expectExcel(rows.find(row => row['物料名称'] == name), name, expects[name])
        }
        expectExcel(rows.find(row => row['物料名称'] == '汇总'), '汇总', {
          '理论成本[金额]': 10196,
          '实际成本[金额]': 21628,
          '差异金额': 11432,
          '期初金额': 6500,
          '入库金额': 16536,
          '出库金额': 22328,
          '期末金额': 708
        })
      }
    })
  }

  /**
   * 餐品统计下载。按菜品名称排序，没有物料行的清炒萝卜不出现。
   * 用料占比和金额占比都是理论数量占比。羊肉、洋葱的差异看 productId 谁小。
   */
  private checkProductExcel(): DownloadExcelAction {
    let variable = this.getVariable()
    return new DownloadExcelAction({
      name: '餐品统计下载',
      url: '/app/state/stateByProduct',
      param: {
        begin: '2026-09-01',
        end: '2026-09-30',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(rows: any[]) {
        CheckUtil.expectEqual(rows.length, 9, `餐品统计应为9行，实际${rows.length}`)
        CheckUtil.expectEqual(
          rows.some(row => row['菜品名称'] == '清炒萝卜' || row['物料名称'] == '塑料杯'),
          false,
          '清炒萝卜和塑料杯不应出现'
        )
        let fryExtra = Number(variable.product?.['羊肉炒白菜']) < Number(variable.product?.['萝卜煮羊肉'])
        let jinExtra = Number(variable.product?.['洋葱按斤']) < Number(variable.product?.['洋葱按克'])
        let fryCost = (197142 + (fryExtra ? 1 : 0)) / 100
        let stewCost = (354857 + (fryExtra ? 0 : 1)) / 100
        let jinCost = (7142 + (jinExtra ? 1 : 0)) / 100
        let gramCost = (2857 + (jinExtra ? 0 : 1)) / 100
        let find = (product: string, material: string) =>
          rows.find(row => row['菜品名称'] == product && row['物料名称'] == material)
        expectExcel(find('红烧牛肉', '牛肉'), '红烧牛肉牛肉', {
          '物料编码': 'MAT_BEEF', '菜品销量': 80, 'bom数量': '30克',
          '消耗数量总和': '24包', '用料占比': '100%', '差异数量': '11包50克',
          '消耗金额总和': 5760, '金额占比': '100%', '差异金额': 3440
        })
        expectExcel(find('羊肉炒白菜', '羊肉'), '羊肉炒白菜羊肉', {
          '物料编码': 'MAT_LAMB', '菜品销量': 100, 'bom数量': '10克',
          '消耗数量总和': '10包', '用料占比': '35.71%',
          '差异数量': fryExtra ? '-32克' : '-33克',
          '消耗金额总和': 1200, '金额占比': '35.71%', '差异金额': fryCost - 1200
        })
        expectExcel(find('羊肉炒白菜', '白菜'), '羊肉炒白菜白菜', {
          '物料编码': 'MAT_CABBAGE', '菜品销量': 100, 'bom数量': '20克',
          '消耗数量总和': '4斤', '用料占比': '100%', '差异数量': '30斤',
          '消耗金额总和': 320, '金额占比': '100%', '差异金额': 3980
        })
        expectExcel(find('萝卜煮羊肉', '羊肉'), '萝卜煮羊肉羊肉', {
          '物料编码': 'MAT_LAMB', '菜品销量': 60, 'bom数量': '30克',
          '消耗数量总和': '18包', '用料占比': '64.29%',
          '差异数量': fryExtra ? '-58克' : '-57克',
          '消耗金额总和': 2160, '金额占比': '64.29%', '差异金额': stewCost - 2160
        })
        expectExcel(find('萝卜煮羊肉', '萝卜'), '萝卜煮羊肉萝卜', {
          '物料编码': 'MAT_RADISH', '菜品销量': 60, 'bom数量': '40克',
          '消耗数量总和': '4斤400克', '用料占比': '100%', '差异数量': '30斤100克',
          '消耗金额总和': 288, '金额占比': '100%', '差异金额': 1912
        })
        expectExcel(find('番茄炒蛋', '番茄'), '番茄炒蛋番茄', {
          '物料编码': 'MAT_TOMATO', '菜品销量': 10, 'bom数量': '2个',
          '消耗数量总和': '20个', '用料占比': '100%', '差异数量': '0个',
          '消耗金额总和': 200, '金额占比': '100%', '差异金额': 40
        })
        expectExcel(find('番茄炒蛋', '鸡蛋'), '番茄炒蛋鸡蛋', {
          '物料编码': 'MAT_EGG', '菜品销量': 10, 'bom数量': '3个',
          '消耗数量总和': '30个', '用料占比': '100%', '差异数量': '-20个',
          '消耗金额总和': 240, '金额占比': '100%', '差异金额': -180
        })
        expectExcel(find('洋葱按斤', '洋葱'), '洋葱按斤洋葱', {
          '物料编码': 'MAT_ONION', '菜品销量': 2, 'bom数量': '1斤',
          '消耗数量总和': '2斤', '用料占比': '71.43%',
          '差异数量': jinExtra ? '5斤72克' : '5斤71克',
          '消耗金额总和': 20, '金额占比': '71.43%', '差异金额': jinCost - 20
        })
        expectExcel(find('洋葱按克', '洋葱'), '洋葱按克洋葱', {
          '物料编码': 'MAT_ONION', '菜品销量': 4, 'bom数量': '100克',
          '消耗数量总和': '400克', '用料占比': '28.57%',
          '差异数量': jinExtra ? '2斤28克' : '2斤29克',
          '消耗金额总和': 8, '金额占比': '28.57%', '差异金额': gramCost - 8
        })
      }
    })
  }

  /**
   * 进销存下载。采购含其他入库，出库是实际消耗。不再有按应付账款计算的列。
   * 数量是默认单位上的数字。
   */
  private checkPsiExcel(): MultiSheetDownloadAction {
    let expects: { [name: string]: any } = {
      牛肉: {
        '分类名称': '肉类', '单位': '包',
        '期初数量': 10, '期初金额': 2000, '期初价格': 200,
        '采购数量': 26.5, '采购金额': 7240, '采购单价': 273.21,
        '出库数量': 35.5, '出库金额': 9200, '出库单价': 259.15,
        '期末数量': 1, '期末金额': 40, '期末单价': 40
      },
      羊肉: {
        '分类名称': '肉类', '单位': '包',
        '期初数量': 10, '期初金额': 1500, '期初价格': 150,
        '采购数量': 18.1, '采购金额': 4380, '采购单价': 241.99,
        '出库数量': 27.1, '出库金额': 5520, '出库单价': 203.69,
        '期末数量': 1, '期末金额': 360, '期末单价': 360
      },
      白菜: {
        '分类名称': '蔬菜', '单位': '斤',
        '期初数量': 20, '期初金额': 2000, '期初价格': 100,
        '采购数量': 20, '采购金额': 3000, '采购单价': 150,
        '出库数量': 39, '出库金额': 4800, '出库单价': 123.08,
        '期末数量': 1, '期末金额': 200, '期末单价': 200
      },
      萝卜: {
        '分类名称': '蔬菜', '单位': '斤',
        '期初数量': 20, '期初金额': 1000, '期初价格': 50,
        '采购数量': 20, '采购金额': 1500, '采购单价': 75,
        '出库数量': 39, '出库金额': 2400, '出库单价': 61.54,
        '期末数量': 1, '期末金额': 100, '期末单价': 100
      },
      塑料杯: {
        '分类名称': '蔬菜', '单位': '个',
        '期初数量': 0, '期初金额': 0, '期初价格': 0,
        '采购数量': 8, '采购金额': 16, '采购单价': 2,
        '出库数量': 4, '出库金额': 8, '出库单价': 2,
        '期末数量': 4, '期末金额': 8, '期末单价': 2
      },
      番茄: {
        '分类名称': '蔬菜', '单位': '个',
        '期初数量': 0, '期初金额': 0, '期初价格': 0,
        '采购数量': 20, '采购金额': 240, '采购单价': 12,
        '出库数量': 20, '出库金额': 240, '出库单价': 12,
        '期末数量': 0, '期末金额': 0, '期末单价': 0
      },
      鸡蛋: {
        '分类名称': '蛋类', '单位': '个',
        '期初数量': 0, '期初金额': 0, '期初价格': 0,
        '采购数量': 10, '采购金额': 60, '采购单价': 6,
        '出库数量': 10, '出库金额': 60, '出库单价': 6,
        '期末数量': 0, '期末金额': 0, '期末单价': 0
      },
      洋葱: {
        '分类名称': '蔬菜', '单位': '斤',
        '期初数量': 0, '期初金额': 0, '期初价格': 0,
        '采购数量': 10, '采购金额': 100, '采购单价': 10,
        '出库数量': 10, '出库金额': 100, '出库单价': 10,
        '期末数量': 0, '期末金额': 0, '期末单价': 0
      }
    }
    let payable = [
      '按应付账款计算的入库数量',
      '按应付账款计算的入库金额',
      '按应付账款计算的入库单价',
      '按应付账款计算的出库数量',
      '按应付账款计算的出库金额',
      '按应付账款计算的出库单价'
    ]
    return new MultiSheetDownloadAction({
      name: '进销存下载',
      url: '/app/state/psi',
      param: {
        begin: '2026-09-01',
        end: '2026-09-30',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(sheets: any) {
        let names = Object.keys(sheets ?? {})
        CheckUtil.expectEqual(names[0], '总计', `第一个sheet应为总计，实际${names[0]}`)
        let rows: any[] = sheets['总计'] ?? []
        CheckUtil.expectEqual(rows.length, 9, `总计应为8个物料加汇总，实际${rows.length}`)
        let header = Object.keys(rows[0] ?? {})
        for (let col of payable) {
          CheckUtil.expectEqual(header.indexOf(col) < 0, true, `不应再有列${col}`)
        }
        for (let name in expects) {
          expectExcel(rows.find(row => row['物料名称'] == name), name, expects[name])
        }
        expectExcel(rows.find(row => row['物料名称'] == '汇总'), '汇总', {
          '期初金额': 6500,
          '采购金额': 16536,
          '出库金额': 22328,
          '期末金额': 708
        })
      }
    })
  }

  /**
   * 餐厅端统计时间。待入库按发单时间，已入库按入库时间。
   * 番茄只发单，时间是 10月1日。塑料杯已入库，发单 10月2日、入库 10月3日。
   */
  private checkStoreNoteTime(): BaseTest[] {
    return [
      new Action({
        name: '10月1日番茄下单',
        url: '/app/note/createNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          items: [{
            materialId: '${materialMap.番茄.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 5,
            buyUnitFee: 1,
            price: 12,
            stockBuyUnitFee: 1
          }]
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result ?? []
          return { timeNote: content[0] }
        }
      }),
      new Action({
        name: '10月1日番茄发送',
        url: '/app/note/sendNote',
        param: {
          noteIds: ['${timeNote.noteId}'],
          status: 'normal'
        }
      }),
      this.updateNoteTime('番茄待入库', '${timeNote.noteId}', '2026-10-01'),
      ...this.instockNote('10月3日塑料杯', '2026-10-03', 'timeCupNote', [
        { material: '塑料杯', supplier: '供应商1', cnt: 3, buyUnitFee: 1, price: 2, stockBuyUnitFee: 1 }
      ]),
      new Action({
        name: '塑料杯发单改到10月2日',
        remark: '入库时间仍是10月3日。已入库按入库时间统计',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${timeCupNote.noteId}',
          createTime: '2026-10-02 00:00:00',
          lastUpdateTime: '2026-10-03 00:00:00',
          warehouseId: '${warehouse.warehouseId}'
        }
      }),
      this.checkStoreNoteExcel('2026-10-01', {
        番茄: { '单位': '个', '订货数量合计': 5, '供应商1': 5 }
      }),
      this.checkStoreNoteExcel('2026-10-02', {}),
      this.checkStoreNoteExcel('2026-10-03', {
        塑料杯: { '单位': '个', '订货数量合计': 3, '供应商1': 3 }
      }),
      new Action({
        name: '塑料杯结算',
        remark: '结算不改入库时间。应付款按 instockTime 统计',
        url: '/app/note/processNote',
        param: {
          noteId: '${timeCupNote.noteId}',
          action: 'statement',
          warehouseId: '${warehouse.warehouseId}'
        }
      }),
      this.checkStateNote('2026-10-02', false),
      this.checkStateNote('2026-10-03', true),
      this.checkListNoteTime('订单列表10月2日', '2026-10-02', '2026-10-02', []),
      this.checkListNoteTime('订单列表到10月2日', '2026-10-01', '2026-10-02', ['timeNote']),
      this.checkListNoteTime('订单列表10月3日', '2026-10-03', '2026-10-03', ['timeCupNote']),
      this.checkListNoteTime('订单列表10月1日到3日', '2026-10-01', '2026-10-03', ['timeNote', 'timeCupNote'])
    ]
  }

  /**
   * listNote 的 beginInstockOrCreateTime、endInstockOrCreateTime。
   * 待入库按发单时间，已入库按入库时间。end 含当天，条件是小于后一天。
   */
  private checkListNoteTime(name: string, begin: string, end: string, noteKeys: string[]): Action {
    let variable = this.getVariable()
    return new Action({
      name,
      url: '/app/note/listNote',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        beginInstockOrCreateTime: begin,
        endInstockOrCreateTime: end,
        pageSize: 50
      }
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        let expectIds = noteKeys.map(key => String(variable[key]?.noteId)).sort()
        let actual = content.map(row => String(row.noteId)).sort()
        CheckUtil.expectEqual(
          actual.join(','),
          expectIds.join(','),
          `${name}订单应为[${expectIds.join(',')}]，实际[${actual.join(',')}]`
        )
      }
    })
  }

  /**
   * 已结算订单按入库时间进应付款。塑料杯发单 10月2日、入库 10月3日，金额 3×2=6。
   * 明细上的日期仍是发单时间。
   */
  private checkStateNote(day: string, hit: boolean): MultiSheetDownloadAction {
    return new MultiSheetDownloadAction({
      name: `应付款${day}`,
      url: '/app/state/stateNote',
      param: {
        begin: day,
        end: day,
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(sheets: any) {
        let sumRows: any[] = sheets?.['应付款汇总'] ?? []
        let supplier = sumRows.find(row => row['供应商名称'] == '供应商1')
        let noteRows: any[] = sheets?.['供应商1'] ?? []
        if (!hit) {
          CheckUtil.expectEqual(supplier == null, true, `${day}不应有供应商1，发单时间不是入库时间`)
          CheckUtil.expectEqual(noteRows.length, 0, `${day}不应有供应商明细`)
          return
        }
        expectExcel(supplier, `${day}应付款汇总`, { '应付账款': 6 })
        expectExcel(sumRows.find(row => row['供应商名称'] == '汇总'), `${day}应付款合计`, { '应付账款': 6 })
        let note = noteRows.find(row => row['订单号'] != '汇总')
        expectExcel(note, `${day}塑料杯订单`, {
          '日期': '2026-10-02',
          '物料数量': 1,
          '入库金额': 6,
          '结算金额': 6,
          '评分': '没有评分'
        })
      }
    })
  }

  /** 订货数量合计按餐厅端时间过滤。这一天没有发货数量。 */
  private checkStoreNoteExcel(day: string, expects: { [name: string]: any }): MultiSheetDownloadAction {
    let names = Object.keys(expects)
    return new MultiSheetDownloadAction({
      name: `门店订货${day}`,
      url: '/app/state/stateNote4Supplier',
      param: {
        begin: day,
        end: day,
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(sheets: any) {
        let rows: any[] = sheets?.['订货数量合计'] ?? []
        let got = rows.map(row => row['物料名']).filter(name => name != null && name !== '')
        CheckUtil.expectEqual(got.length, names.length, `${day}订货物料数应为${names.length}，实际${got.join(',')}`)
        for (let name of names) {
          expectExcel(rows.find(row => row['物料名'] == name), `${day}${name}`, expects[name])
        }
        let sendRows: any[] = sheets?.['发货数量合计'] ?? []
        CheckUtil.expectEqual(sendRows.length, 0, `${day}没有发货数量，实际${sendRows.length}行`)
      }
    })
  }

  /** 两个餐品都返回。数量用 format 之后的系数 500。 */
  private checkOnionShare(): Action {
    let variable = this.getVariable()
    return new Action({
      name: '洋葱餐品成本',
      url: '/app/state2/listProductAmount',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: '2026-09-01',
        end: '2026-09-30',
        materialId: '${materialMap.洋葱.materialId}',
        pageSize: 10
      }
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        CheckUtil.expectEqual(content.length, 2, `洋葱餐品应为2个，实际${content.length}`)
        CheckUtil.expectEqual(content[0].name, '洋葱按斤', `应按实际成本倒序，第一行实际${content[0]?.name}`)
        let jin = content.find(row => row.name == '洋葱按斤')
        let gram = content.find(row => row.name == '洋葱按克')
        CheckUtil.expectEqual(jin != null && gram != null, true, '缺少洋葱按斤或洋葱按克')
        CheckUtil.expectEqual(Number(jin.cnt), 2, `洋葱按斤销量应为2，实际${jin.cnt}`)
        CheckUtil.expectEqual(Number(gram.cnt), 4, `洋葱按克销量应为4，实际${gram.cnt}`)
        CheckUtil.expectEqual(Number(jin.costOfTheory), 20, `洋葱按斤理论成本应为20，实际${jin.costOfTheory}`)
        CheckUtil.expectEqual(Number(gram.costOfTheory), 8, `洋葱按克理论成本应为8，实际${gram.costOfTheory}`)
        let jinId = Number(variable.product?.['洋葱按斤'])
        let gramId = Number(variable.product?.['洋葱按克'])
        let jinExtra = jinId < gramId
        expectOnionLine(jin, '洋葱按斤', {
          cntOfTheory: 1000,
          cnt: 3571 + (jinExtra ? 1 : 0),
          cost: (7142 + (jinExtra ? 1 : 0)) / 100,
          costOfTheory: 20
        })
        expectOnionLine(gram, '洋葱按克', {
          cntOfTheory: 400,
          cnt: 1428 + (jinExtra ? 0 : 1),
          cost: (2857 + (jinExtra ? 0 : 1)) / 100,
          costOfTheory: 8
        })
      }
    })
  }

  /** pageSize=1，按成本倒序翻页。 */
  private checkOnionPage(first: number, name: string): Action {
    return new Action({
      name: `洋葱餐品第${first + 1}页`,
      url: '/app/state2/listProductAmount',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: '2026-09-01',
        end: '2026-09-30',
        materialId: '${materialMap.洋葱.materialId}',
        pageSize: 1,
        _first: first,
        _needCnt: true
      }
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        CheckUtil.expectEqual(content.length, 1, `第${first + 1}页应只有1个餐品，实际${content.length}`)
        CheckUtil.expectEqual(content[0]?.name, name, `第${first + 1}页应为${name}，实际${content[0]?.name}`)
        CheckUtil.expectEqual(
          Number(result.result?.totalElements),
          2,
          `洋葱餐品总数应为2，实际${result.result?.totalElements}`
        )
      }
    })
  }

  /** 记下后面要改的流水：牛肉只改单价，塑料杯只改数量，羊肉和其他入库同时改。 */
  private saveBeefInstockIds(): Action {
    return new Action({
      name: '记下要改的入库流水',
      url: '/app/state2/listMaterialAmount',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: '2026-09-01',
        end: '2026-09-30',
        pageSize: 100,
        _needInstock: true
      }
    }, {
      buildVariable(result) {
        let content: any[] = result.result?.content ?? []
        let beef = content.find(row => row.name == '牛肉')
        let cup = content.find(row => row.name == '塑料杯')
        let beefInstocks: any[] = beef?.instocks ?? []
        let cupInstocks: any[] = cup?.instocks ?? []
        let lamb = content.find(row => row.name == '羊肉')
        let lambInstocks: any[] = lamb?.instocks ?? []
        let sep2 = beefInstocks.find(row => dayText(row.time) == '2026-09-02' && row.type == 'Instock')
        let sep5 = beefInstocks.find(row => dayText(row.time) == '2026-09-05' && row.type == 'Instock')
        let cupSep7 = cupInstocks.find(row => dayText(row.time) == '2026-09-07' && row.type == 'Instock')
        let lambSep5 = lambInstocks.find(row => dayText(row.time) == '2026-09-05' && row.type == 'Instock')
        let beefOther = beefInstocks.find(row => row.type == 'otherInstock')
        return {
          beefSep2Id: sep2?.stockRecordId,
          beefSep5Id: sep5?.stockRecordId,
          cupSep7Id: cupSep7?.stockRecordId,
          lambSep5Id: lambSep5?.stockRecordId,
          beefOtherId: beefOther?.stockRecordId
        }
      },
      check(result) {
        let content: any[] = result.result?.content ?? []
        let beef = content.find(row => row.name == '牛肉')
        let cup = content.find(row => row.name == '塑料杯')
        let lamb = content.find(row => row.name == '羊肉')
        let beefInstocks: any[] = beef?.instocks ?? []
        let cupInstocks: any[] = cup?.instocks ?? []
        let lambInstocks: any[] = lamb?.instocks ?? []
        let sep2 = beefInstocks.find(row => dayText(row.time) == '2026-09-02' && row.type == 'Instock')
        let sep5 = beefInstocks.find(row => dayText(row.time) == '2026-09-05' && row.type == 'Instock')
        let cupSep7 = cupInstocks.find(row => dayText(row.time) == '2026-09-07' && row.type == 'Instock')
        let lambSep5 = lambInstocks.find(row => dayText(row.time) == '2026-09-05' && row.type == 'Instock')
        let beefOther = beefInstocks.find(row => row.type == 'otherInstock')
        CheckUtil.expectEqual(sep2?.stockRecordId != null, true, '牛肉9月2日入库流水不存在')
        CheckUtil.expectEqual(sep5?.stockRecordId != null, true, '牛肉9月5日入库流水不存在')
        CheckUtil.expectEqual(cupSep7?.stockRecordId != null, true, '塑料杯9月7日入库流水不存在')
        CheckUtil.expectEqual(lambSep5?.stockRecordId != null, true, '羊肉9月5日入库流水不存在')
        CheckUtil.expectEqual(beefOther?.stockRecordId != null, true, '牛肉其他入库流水不存在')
      }
    })  }

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
      }, {
        buildVariable(result) {
          return { beefOtherUseId: result.result?.otherUseId }
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

  /**
   * 整月按 amount 倒序翻页。pageSize=2，第 2 页 _first=2，第 3 页 _first=4。
   */
  private checkMaterialPage(opt: {
    name: string
    first?: number
    names: string[]
  }): Action {
    let param: any = {
      warehouseId: '${warehouse.warehouseId}',
      begin: '2026-09-01',
      end: '2026-09-30',
      pageSize: 2
    }
    if (opt.first != null) {
      param._first = opt.first
    }
    return new Action({
      name: opt.name,
      url: '/app/state2/listMaterialAmount',
      param
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        let names = content.map(row => row.name).join(',')
        CheckUtil.expectEqual(names, opt.names.join(','), `${opt.name}应为${opt.names.join(',')}，实际=${names}`)
        for (let i = 1; i < content.length; i++) {
          CheckUtil.expectEqual(
            Number(content[i - 1].amount) >= Number(content[i].amount),
            true,
            `${opt.name}应按amount倒序`
          )
        }
      }
    })
  }

  /**
   * inPriceDiff、inCntDiff 先筛再按 amount 倒序翻页。
   * 不传的条件不参与。true 只留不一致，false 只留一致。
   */
  private checkMaterialFilter(opt: {
    name: string
    begin?: string
    end?: string
    inPriceDiff?: boolean
    inCntDiff?: boolean
    pageSize?: number
    first?: number
    ordered?: boolean
    names: string[]
  }): Action {
    let param: any = {
      warehouseId: '${warehouse.warehouseId}',
      begin: opt.begin ?? '2026-09-01',
      end: opt.end ?? '2026-09-30',
      pageSize: opt.pageSize ?? 100
    }
    if (opt.first != null) {
      param._first = opt.first
    }
    if (opt.inPriceDiff != null) {
      param.inPriceDiff = opt.inPriceDiff
    }
    if (opt.inCntDiff != null) {
      param.inCntDiff = opt.inCntDiff
    }
    return new Action({
      name: opt.name,
      url: '/app/state2/listMaterialAmount',
      param
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        let actual = content.map(row => row.name)
        let expect = opt.names
        if (opt.ordered == false) {
          actual = [...actual].sort()
          expect = [...expect].sort()
        }
        CheckUtil.expectEqual(
          actual.join(','),
          expect.join(','),
          `${opt.name}应为${expect.join(',') || '空'}，实际=${actual.join(',') || '空'}`
        )
      }
    })  }

  /** _needProductCnts 为 true 时回填 productCnt。按餐品去重，不是销量。 */
  private checkProductCnt(opt: {
    name: string
    begin?: string
    end?: string
    need?: boolean
    pageSize?: number
    counts?: { [name: string]: number }
    names?: string[]
  }): Action {
    let need = opt.need != false
    let param: any = {
      warehouseId: '${warehouse.warehouseId}',
      begin: opt.begin ?? '2026-09-01',
      end: opt.end ?? '2026-09-30',
      pageSize: opt.pageSize ?? 100,
      _needProductCnts: need
    }
    return new Action({
      name: opt.name,
      url: '/app/state2/listMaterialAmount',
      param
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        if (!need) {
          let names = opt.names ?? []
          CheckUtil.expectEqual(
            content.map(row => row.name).join(','),
            names.join(','),
            `${opt.name}应为${names.join(',')}，实际=${content.map(row => row.name).join(',')}`
          )
          for (let row of content) {
            CheckUtil.expectEqual(row.productCnt == null, true, `${opt.name}${row.name}不应有productCnt`)
          }
          return
        }
        let counts = opt.counts ?? {}
        let actualNames = content.map(row => row.name).sort().join(',')
        let expectNames = Object.keys(counts).sort().join(',')
        CheckUtil.expectEqual(actualNames, expectNames, `${opt.name}物料应为${expectNames}，实际=${actualNames}`)
        for (let row of content) {
          CheckUtil.expectEqual(
            Number(row.productCnt),
            counts[row.name],
            `${opt.name}${row.name}餐品数，期望${counts[row.name]}，实际${row.productCnt}`
          )
        }
      }
    })  }

  /**
   * 当前页的采购入库和其他入库。退货不在里面。
   * 其他入库单价用 calPrice 的结果，和 50元/包 用 isEqPrice 比较。
   */
  private checkInstocks(opt: {
    name: string
    begin?: string
    end?: string
    pageSize?: number
    first?: number
    notInBom?: boolean
    rows: Array<{
      name: string
      instocks: Array<{
        day: string
        type: string
        cnt: number
        buyUnitFee: number
        price: number
        stockBuyUnitFee: number
      }>
    }>
  }): Action {
    let param: any = {
      warehouseId: '${warehouse.warehouseId}',
      begin: opt.begin ?? '2026-09-01',
      end: opt.end ?? '2026-09-30',
      pageSize: opt.pageSize ?? 100,
      _needInstock: true
    }
    if (opt.first != null) {
      param._first = opt.first
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
        let actualNames = content.map(row => row.name).join(',')
        let expectNames = opt.rows.map(row => row.name).join(',')
        CheckUtil.expectEqual(actualNames, expectNames, `${opt.name}应为${expectNames}，实际=${actualNames}`)
        for (let expectRow of opt.rows) {
          let row = content.find(item => item.name == expectRow.name)
          let instocks: any[] = row?.instocks ?? []
          CheckUtil.expectEqual(
            instocks.length,
            expectRow.instocks.length,
            `${opt.name}${expectRow.name}入库条数，期望${expectRow.instocks.length}，实际${instocks.length}`
          )
          for (let i = 0; i < expectRow.instocks.length; i++) {
            let actual = instocks[i] ?? {}
            let expect = expectRow.instocks[i]
            CheckUtil.expectEqual(actual.stockRecordId != null, true, `${opt.name}${expectRow.name}第${i + 1}条应有stockRecordId`)
            CheckUtil.expectEqual(
              dayText(actual.time),
              expect.day,
              `${opt.name}${expectRow.name}第${i + 1}条时间，期望${expect.day}，实际${actual.time}`
            )
            CheckUtil.expectEqual(
              actual.type,
              expect.type,
              `${opt.name}${expectRow.name}第${i + 1}条类型，期望${expect.type}，实际${actual.type}`
            )
            CheckUtil.expectEqual(
              StockUtil.isEq(
                { cnt: Number(actual.cnt), buyUnitFee: Number(actual.buyUnitFee) },
                { cnt: expect.cnt, buyUnitFee: expect.buyUnitFee }
              ),
              true,
              `${opt.name}${expectRow.name}第${i + 1}条数量，期望${expect.cnt}/${expect.buyUnitFee}，实际${actual.cnt}/${actual.buyUnitFee}`
            )
            CheckUtil.expectEqual(
              StockUtil.isEqPrice(
                { price: Number(actual.price), buyUnitFee: Number(actual.stockBuyUnitFee) },
                { price: expect.price, buyUnitFee: expect.stockBuyUnitFee }
              ),
              true,
              `${opt.name}${expectRow.name}第${i + 1}条单价，期望${expect.price}/${expect.stockBuyUnitFee}，实际${actual.price}/${actual.stockBuyUnitFee}`
            )
            CheckUtil.expectEqual(actual.addUser != null && actual.addUser !== '', true, `${opt.name}${expectRow.name}应有addUser`)
            CheckUtil.expectEqual(
              actual.userOfAdd?.name != null && actual.userOfAdd.name !== '',
              true,
              `${opt.name}${expectRow.name}应有userOfAdd.name`
            )
          }
        }
      }
    })  }

  /**
   * 只统计销售副本里的物料。塑料杯不在里面。
   */
  private checkCostDiff(opt: {
    name: string
    begin: string
    end: string
    priceDiffCnt: number
    cntDiffCnt: number
  }): Action {
    return new Action({
      name: opt.name,
      url: '/app/state2/costDiff',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: opt.begin,
        end: opt.end
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(
          Number(result.result.priceDiffCnt),
          opt.priceDiffCnt,
          `${opt.name}单价不一致物料数，期望${opt.priceDiffCnt}，实际${result.result.priceDiffCnt}`
        )
        CheckUtil.expectEqual(
          Number(result.result.cntDiffCnt),
          opt.cntDiffCnt,
          `${opt.name}数量不一致物料数，期望${opt.cntDiffCnt}，实际${result.result.cntDiffCnt}`
        )
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
  /** 同时改数量和单价后，核对订货明细。价格取 supplierMaterial，数量取 instock。 */
  private checkNoteItemChanged(): Action {
    let variable = this.getVariable()
    return new Action({
      name: '核对羊肉订货明细',
      url: '/app/noteItem/listNoteItem',
      param: { noteId: '${sep5Note2.noteId}' }
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        let lambId = variable.materialMap?.羊肉?.materialId
        let radishId = variable.materialMap?.萝卜?.materialId
        let lamb = content.find(row => String(row.materialId) === String(lambId))
        let radish = content.find(row => String(row.materialId) === String(radishId))
        CheckUtil.expectEqual(lamb != null, true, '9月5日订单缺少羊肉')
        CheckUtil.expectEqual(
          StockUtil.isEq(
            { cnt: Number(lamb?.instock?.cnt), buyUnitFee: Number(lamb?.instock?.buyUnitFee) },
            { cnt: 8, buyUnitFee: 1 }
          ),
          true,
          `羊肉入库数量应为8，实际 cnt=${lamb?.instock?.cnt} buyUnitFee=${lamb?.instock?.buyUnitFee}`
        )
        CheckUtil.expectEqual(
          StockUtil.isEqPrice(
            { price: Number(lamb?.supplierMaterial?.price), buyUnitFee: Number(lamb?.supplierMaterial?.buyUnitFee) },
            { price: 360, buyUnitFee: 1 }
          ),
          true,
          `羊肉单价应为360，实际 price=${lamb?.supplierMaterial?.price} buyUnitFee=${lamb?.supplierMaterial?.buyUnitFee}`
        )
        CheckUtil.expectEqual(radish != null, true, '9月5日订单缺少萝卜')
        CheckUtil.expectEqual(
          StockUtil.isEq(
            { cnt: Number(radish?.instock?.cnt), buyUnitFee: Number(radish?.instock?.buyUnitFee) },
            { cnt: 10, buyUnitFee: 1 }
          ),
          true,
          `萝卜入库数量应为10，实际 cnt=${radish?.instock?.cnt}`
        )
        CheckUtil.expectEqual(
          StockUtil.isEqPrice(
            { price: Number(radish?.supplierMaterial?.price), buyUnitFee: Number(radish?.supplierMaterial?.buyUnitFee) },
            { price: 100, buyUnitFee: 1 }
          ),
          true,
          `萝卜单价应为100，实际 price=${radish?.supplierMaterial?.price}`
        )
      }
    })  }

  /** 同时改数量和单价后，核对其他入库明细。 */
  private checkOtherItemChanged(): Action {
    let variable = this.getVariable()
    return new Action({
      name: '核对牛肉其他入库明细',
      url: '/app/otherItem/listOtherItem',
      param: { otherUseId: '${beefOtherUseId}' }
    }, {
      check(result) {
        let content: any[] = result.result?.content ?? []
        let beefId = variable.materialMap?.牛肉?.materialId
        let beef = content.find(row => String(row.materialId) === String(beefId))
        CheckUtil.expectEqual(beef != null, true, '其他入库缺少牛肉')
        CheckUtil.expectEqual(
          StockUtil.isEq(
            { cnt: Number(beef?.cnt), buyUnitFee: Number(beef?.buyUnitFee) },
            { cnt: 6, buyUnitFee: 1 }
          ),
          true,
          `牛肉其他入库数量应为6，实际 cnt=${beef?.cnt} buyUnitFee=${beef?.buyUnitFee}`
        )
        CheckUtil.expectEqual(
          StockUtil.isEqPrice(
            { price: Number(beef?.price), buyUnitFee: Number(beef?.stockBuyUnitFee) },
            { price: 40, buyUnitFee: 1 }
          ),
          true,
          `牛肉其他入库单价应为40，实际 price=${beef?.price} buyUnitFee=${beef?.stockBuyUnitFee}`
        )
      }
    })  }

  private checkStock(costOf?: { [name: string]: number }): BaseTest {
    let variable = this.getVariable()
    let expects = [
      { name: '牛肉', cnt: 1, buyUnitFee: 1, cost: costOf?.牛肉 ?? 50 },
      { name: '羊肉', cnt: 1, buyUnitFee: 1, cost: costOf?.羊肉 ?? 300 },
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

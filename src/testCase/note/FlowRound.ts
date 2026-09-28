import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import QueryAction from "../../action/QueryAction";
import CheckArray from "../../action/CheckArray";
import StockUtil from "../../util/StockUtil";

const MATERIAL_NAME = '西瓜';
/** 9千克50克 = 9050 克 */
const ORDER_GRAM = 9050;
/** 9.05×3.5=31.675，四舍五入到分应为 31.68（不能是 31.67） */
const EXPECT_COST = 31.68;
const EXPECT_PRICE = 3.5;

function findUnit(buyUnit: any[], names: string[]) {
  return (buyUnit ?? []).find((row: any) => names.includes(row.name));
}

/**
 * 克相对标准单位的 buyUnitFee：标准=克 → 1；标准=千克 → 1000（1g=1/1000kg）
 */
function gramBuyUnitFee(material: any, gram: any, kg: any): number {
  if (gram?.unitsId == null) {
    throw new Error(`西瓜规格缺少克: ${JSON.stringify(material?.buyUnit)}`);
  }
  if (String(material.unitsId) === String(gram.unitsId)) {
    return 1;
  }
  if (kg?.unitsId != null && String(material.unitsId) === String(kg.unitsId)) {
    return 1000;
  }
  throw new Error(`西瓜标准单位既不是克也不是千克: unitsId=${material.unitsId}`);
}

/**
 * 千克相对标准单位的 buyUnitFee：标准=千克 → 1；标准=克 → -1000（1kg=1000g）
 */
function kgBuyUnitFee(material: any, gram: any, kg: any): number {
  if (kg?.unitsId == null) {
    throw new Error(`西瓜规格缺少千克: ${JSON.stringify(material?.buyUnit)}`);
  }
  if (String(material.unitsId) === String(kg.unitsId)) {
    return 1;
  }
  if (gram?.unitsId != null && String(material.unitsId) === String(gram.unitsId)) {
    return -1000;
  }
  throw new Error(`西瓜标准单位既不是克也不是千克: unitsId=${material.unitsId}`);
}

/**
 * 9千克50克 × 3.5元/千克 = 31.675，金额应四舍五入为 31.68。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '西瓜 9千克50克×3.5元/千克=31.675，订单金额四舍五入为 31.68' });
  }

  getName(): string {
    return '金额四舍五入';
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    return [
      new PreTest({
        materialsOpts: [{
          name: MATERIAL_NAME,
          category: '蔬菜',
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '千克', fee: 1000, isSupplier: true }
          ],
          suppliers: [{
            isDef: true,
            supplierId: '${supplierMap.供应商1}',
            price: EXPECT_PRICE,
            unitsName: '千克'
          }]
        }]
      }).setRemark('初始化餐厅、供应商；西瓜 1千克=1000g，默认价 3.5/千克'),

      new Action({
        name: '读取西瓜规格与单价',
        remark: 'listMaterialByCategory：记下克/千克 buyUnitFee、stockUnitsId、默认价',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          const material = (result.result.content ?? []).find((row: any) => row.name === MATERIAL_NAME);
          if (material == null) {
            throw new Error('未找到西瓜');
          }
          const buyUnit = material.buyUnit ?? [];
          const gram = findUnit(buyUnit, ['克', 'g']);
          const kg = findUnit(buyUnit, ['千克']);
          const sm = material.supplierMaterial ?? {};
          return {
            watermelonMaterialId: material.materialId,
            watermelonStockUnitsId: material.stockUnitsId ?? kg?.unitsId,
            watermelonGramBuyUnitFee: gramBuyUnitFee(material, gram, kg),
            watermelonKgBuyUnitFee: kgBuyUnitFee(material, gram, kg),
            watermelonPrice: sm.price ?? EXPECT_PRICE,
            watermelonPriceFee: sm.buyUnitFee ?? kgBuyUnitFee(material, gram, kg)
          };
        },
        check(result) {
          const material = (result.result.content ?? []).find((row: any) => row.name === MATERIAL_NAME);
          CheckUtil.expectEqual(material != null, true, '未找到西瓜');
          const buyUnit = material.buyUnit ?? [];
          const gram = findUnit(buyUnit, ['克', 'g']);
          const kg = findUnit(buyUnit, ['千克']);
          CheckUtil.expectEqual(gram != null, true, '西瓜规格应含克');
          CheckUtil.expectEqual(kg != null, true, '西瓜规格应含千克');
          const price = material.supplierMaterial ?? {};
          CheckUtil.expectEqual(
            StockUtil.isEqPrice(
              { price: price.price, buyUnitFee: price.buyUnitFee },
              { price: EXPECT_PRICE, buyUnitFee: kgBuyUnitFee(material, gram, kg) }
            ),
            true,
            `西瓜默认价应为 3.5/千克，实际 price=${price.price} fee=${price.buyUnitFee}`
          );
        }
      }),

      new Action({
        name: '下单西瓜9千克50克',
        remark: 'createNote：9050克，单价 3.5/千克；金额 31.675 应四舍五入为 31.68',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          items: [{
            materialId: '${watermelonMaterialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: ORDER_GRAM,
            buyUnitFee: '${watermelonGramBuyUnitFee}',
            stockUnitsId: '${watermelonStockUnitsId}',
            price: '${watermelonPrice}',
            stockBuyUnitFee: '${watermelonPriceFee}'
          }]
        }
      }, {
        buildVariable(result) {
          const notes = Array.isArray(result.result) ? result.result : [];
          return {
            noteId: notes[0]?.noteId,
            noteIds: notes.map((row: any) => row.noteId)
          };
        },
        check(result) {
          const notes = Array.isArray(result.result) ? result.result : [];
          CheckUtil.expectEqual(notes.length, 1, '应生成1张西瓜订单');
          CheckUtil.expectEqual(
            notes[0].cost,
            EXPECT_COST,
            `订单金额应为 ${EXPECT_COST}（9.05×3.5=31.675 四舍五入），实际=${notes[0].cost}`
          );
        }
      }),

      new QueryAction({
        name: 'listNote校验订单金额',
        url: '/app/note/listNote',
        query: {
          noteId: '${noteId}'
        },
        checkers: {
          len: 1,
          checkArray: [{
            cost: EXPECT_COST
          }]
        }
      }, {
        check(result) {
          const row = (result.result.content ?? [])[0];
          CheckUtil.expectEqual(row != null, true, 'listNote 未找到西瓜订单');
          CheckUtil.expectEqual(
            row.cost,
            EXPECT_COST,
            `listNote 订单金额应为 ${EXPECT_COST}，实际=${row.cost}`
          );
        }
      }).setRemark('listNote：订单金额 31.68'),

      new QueryAction({
        name: 'listNoteItem校验数量价格',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${noteId}'
        }
      }, {
        check(result) {
          const content = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 1, '应有1条西瓜明细');
          const row = content[0];
          CheckUtil.expectEqual(
            StockUtil.isEq(
              { cnt: row.purcharse?.cnt, buyUnitFee: row.purcharse?.buyUnitFee },
              { cnt: ORDER_GRAM, buyUnitFee: Number(variable.watermelonGramBuyUnitFee) }
            ),
            true,
            `订货数量应为 9千克50克，实际 cnt=${row.purcharse?.cnt} fee=${row.purcharse?.buyUnitFee}`
          );
          CheckUtil.expectEqual(
            StockUtil.isEqPrice(
              { price: row.supplierMaterial?.price, buyUnitFee: row.supplierMaterial?.buyUnitFee },
              { price: EXPECT_PRICE, buyUnitFee: Number(variable.watermelonKgBuyUnitFee) }
            ),
            true,
            `单价应为 3.5/千克，实际 price=${row.supplierMaterial?.price} fee=${row.supplierMaterial?.buyUnitFee}`
          );
        }
      }).setRemark('listNoteItem：数量 9千克50克、单价 3.5/千克'),

      new CheckArray([{
        table: 'note',
        query: {
          noteId: '${noteId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '库表应有1条订单');
          CheckUtil.expectEqual(
            array[0].cost,
            EXPECT_COST,
            `库表 note.cost 应为 ${EXPECT_COST}，实际=${array[0].cost}`
          );
        }
      }, {
        table: 'noteItem',
        query: {
          noteId: '${noteId}',
          isDel: 0
        },
        check(array) {
          CheckUtil.expectEqual(array.length, 1, '库表应有1条明细');
          const row = array[0];
          CheckUtil.expectEqual(
            StockUtil.isEq(
              { cnt: row.cnt, buyUnitFee: row.buyUnitFee },
              { cnt: ORDER_GRAM, buyUnitFee: Number(variable.watermelonGramBuyUnitFee) }
            ),
            true,
            `库表数量应为 9千克50克，实际 cnt=${row.cnt} fee=${row.buyUnitFee}`
          );
          CheckUtil.expectEqual(
            StockUtil.isEqPrice(
              { price: row.price, buyUnitFee: row.stockBuyUnitFee },
              { price: EXPECT_PRICE, buyUnitFee: Number(variable.watermelonKgBuyUnitFee) }
            ),
            true,
            `库表单价应为 3.5/千克，实际 price=${row.price} fee=${row.stockBuyUnitFee}`
          );
        }
      }]).setRemark('free/query：note.cost=31.68，明细只校验数量和单价')
    ];
  }
}

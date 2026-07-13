import { CheckUtil } from "testflow";
import MaterialLinkUtil from "./MaterialLinkUtil";
import StockUtil from "./StockUtil";

/**
 * 比较餐厅 noteItem 与链接单 noteItem。
 *
 * linkUnitFee 含义见 supplyClient/doc/noteItemlinkUnitFee.md：
 * 主单.linkUnitFee 与 链接单.linkUnitFee 表示 n 份主单标准量对应 m 份链接单标准量。
 *
 * 主单库存：instockCnt + buyUnitFee；主单价格：price + stockBuyUnitFee
 * 链接单库存：linkInstockCnt + buyUnitFee；链接单价格：linkPrice + linkStockBuyUnitFee
 *
 * 比较前：materialLink = { unitFee: 主单.linkUnitFee, linkUnitFee: 链接单.linkUnitFee }
 * （与 NoteItemDomain.syncCnt / buildPriceChanger 一致），经 parseCnt / parsePriceFee 换算到链接单侧，
 * 再用 StockUtil.isEq / isEqPrice 比较。
 */
export default class LinkNoteItemUtil {
  static compareStoreAndLink(storeItem: any, supplierItem: any) {
    const name = storeItem.name;
    CheckUtil.expectEqual(supplierItem != null, true, `未找到链接单物料${name}`);
    CheckUtil.expectEqual(storeItem.instock != null, true, `${name}缺少instock`);
    CheckUtil.expectEqual(supplierItem.linkInstockCnt != null, true, `${name}缺少linkInstockCnt`);
    CheckUtil.expectEqual(supplierItem.linkPrice != null, true, `${name}缺少linkPrice`);
    CheckUtil.expectEqual(storeItem.linkUnitFee != null, true, `${name}主单缺少linkUnitFee`);
    CheckUtil.expectEqual(supplierItem.linkUnitFee != null, true, `${name}链接单缺少linkUnitFee`);

    // 与 NoteItemDomain.syncCnt / buildPriceChanger 一致
    const materialLink = {
      unitFee: storeItem.linkUnitFee,
      linkUnitFee: supplierItem.linkUnitFee
    };

    const expectedCnt = MaterialLinkUtil.parseCnt(materialLink, storeItem.instock.cnt);
    const expectedStock = {
      cnt: expectedCnt,
      buyUnitFee: supplierItem.linkInstockCnt.buyUnitFee
    };
    const expectedPrice = MaterialLinkUtil.parsePriceFee(materialLink, {
      price: storeItem.price,
      buyUnitFee: storeItem.stockBuyUnitFee
    });

    const linkStock = StockUtil.linkStockFromNoteItem(supplierItem);
    const linkPrice = StockUtil.linkPriceFromNoteItem(supplierItem);

    CheckUtil.expectEqual(
      StockUtil.isEq(expectedStock, linkStock),
      true,
      `${name}库存不相等：主单换算后${JSON.stringify(expectedStock)}，链接单${JSON.stringify(linkStock)}`
    );

    CheckUtil.expectEqual(
      StockUtil.isEqPrice(expectedPrice, linkPrice),
      true,
      `${name}价格不相等：主单换算后${JSON.stringify(expectedPrice)}，链接单${JSON.stringify(linkPrice)}`
    );

    CheckUtil.expectEqual(
      supplierItem.linkInstockCost,
      storeItem.instockCost,
      `${name}linkInstockCost应与餐厅instockCost一致`
    );
  }
}

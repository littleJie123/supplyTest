/**
 * 与 supplychain MaterialLinkDomain 对齐，用于 parseCnt / parsePriceFee 换算。
 */

import StockUtil, { StockPriceVo } from "./StockUtil";

export interface MaterialLinkVo {
  unitFee: number;
  linkUnitFee: number;
}

export type { StockPriceVo };

export default class MaterialLinkUtil {
  static gcd(a: number, b: number): number {
    return StockUtil.gcd(a, b);
  }

  /**
   * 与 MaterialLinkDomain.format 一致：
   * 把带负数的比例关系转成正数比例；两边都为正时原样返回（不能压成 1:1）。
   */
  static format(link: MaterialLinkVo): MaterialLinkVo {
    if (link.linkUnitFee === 0 && link.unitFee === 0) {
      return { unitFee: 1, linkUnitFee: 1 };
    }
    if (link.linkUnitFee < 0 && link.unitFee < 0) {
      return {
        unitFee: link.linkUnitFee * -1,
        linkUnitFee: link.unitFee * -1
      };
    }
    if (link.linkUnitFee > 0 && link.unitFee < 0) {
      return {
        unitFee: 1,
        linkUnitFee: Math.abs(link.unitFee) * link.linkUnitFee
      };
    }
    if (link.linkUnitFee < 0 && link.unitFee > 0) {
      return {
        linkUnitFee: 1,
        unitFee: Math.abs(link.linkUnitFee) * link.unitFee
      };
    }
    // 两边都为正：原样返回（例如 {1,10} 表示比例信息，不能丢）
    return link;
  }

  static changeLinkFee(storeSupplierLink: MaterialLinkVo, oldNewLink: MaterialLinkVo): MaterialLinkVo {
    storeSupplierLink = this.format(storeSupplierLink);
    oldNewLink = this.format(oldNewLink);
    const unitFee = storeSupplierLink.unitFee * oldNewLink.unitFee;
    const linkUnitFee = storeSupplierLink.linkUnitFee * oldNewLink.linkUnitFee;
    const gcd = this.gcd(unitFee, linkUnitFee);
    return {
      unitFee: unitFee / gcd,
      linkUnitFee: linkUnitFee / gcd
    };
  }

  /**
   * 与 MaterialLinkDomain.parseCnt 一致
   */
  static parseCnt(materialLink: MaterialLinkVo, cnt: number): number {
    if (cnt == null) {
      return 0;
    }
    return StockUtil.calCntWithFee(
      { cnt, buyUnitFee: materialLink.linkUnitFee },
      { buyUnitFee: materialLink.unitFee }
    );
  }

  /**
   * 与 MaterialLinkDomain.parsePriceFee 一致
   */
  static parsePriceFee(materialLink: MaterialLinkVo, price: StockPriceVo): StockPriceVo {
    const swapped = this.format({
      unitFee: materialLink.linkUnitFee,
      linkUnitFee: materialLink.unitFee
    });
    const priceFee = this.format({ unitFee: price.buyUnitFee, linkUnitFee: 1 });
    const newPrice = this.changeLinkFee(priceFee, swapped);
    let ret: StockPriceVo;
    if (newPrice.unitFee === 1) {
      ret = {
        buyUnitFee: -1 * newPrice.linkUnitFee,
        price: price.price
      };
    } else if (newPrice.linkUnitFee === 1) {
      ret = {
        buyUnitFee: newPrice.unitFee,
        price: price.price
      };
    } else {
      ret = {
        buyUnitFee: -1 * newPrice.linkUnitFee,
        price: price.price * newPrice.unitFee
      };
    }
    if (ret.buyUnitFee === -1) {
      ret.buyUnitFee = 1;
    }
    return ret;
  }
}

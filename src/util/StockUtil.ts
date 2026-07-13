import Fraction from "./Fraction";

/** 库存数量：cnt + buyUnitFee */
export interface StockCntVo {
  cnt: number;
  buyUnitFee: number;
}

/** 价格：price + buyUnitFee（主单用 stockBuyUnitFee，链接单用 linkStockBuyUnitFee） */
export interface StockPriceVo {
  price: number;
  buyUnitFee: number;
}

/**
 * 与 supplychain StockDomain 对齐的库存/价格比较工具。
 */
export default class StockUtil {
  static isNumEq(num1: number, num2: number): boolean {
    return Math.abs(num1 - num2) < 0.000001;
  }

  static gcd(a: number, b: number): number {
    a = Math.abs(Math.floor(a));
    b = Math.abs(Math.floor(b));
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  static lcm(a: number, b: number): number {
    if (a === 0 || b === 0) {
      return 0;
    }
    return Math.abs(a * b) / this.gcd(a, b);
  }

  /** 与 StockDomain.buildMinBuyUnitFee 一致 */
  static buildMinBuyUnitFee(fee1: number, fee2: number): number {
    if (fee1 === 0 || fee2 === 0) {
      throw new Error('fee 不能为0');
    }
    if (fee1 > 0 && fee2 > 0) {
      return this.lcm(fee1, fee2);
    }
    if (fee1 < 0 && fee2 < 0) {
      let ret = this.gcd(fee1, fee2) * -1;
      if (ret === -1) {
        ret = 1;
      }
      return ret;
    }
    return Math.max(fee1, fee2);
  }

  /** 与 StockDomain.selectMinBuyUnitFeeStockCnt 一致 */
  static selectMinBuyUnitFeeStockCnt(...stockCnts: StockCntVo[]): { buyUnitFee: number } {
    let ret: { buyUnitFee: number } = null;
    for (const stockCnt of stockCnts) {
      if (stockCnt != null) {
        if (ret == null) {
          ret = { buyUnitFee: stockCnt.buyUnitFee };
        } else {
          ret.buyUnitFee = this.buildMinBuyUnitFee(ret.buyUnitFee, stockCnt.buyUnitFee);
        }
      }
    }
    return ret;
  }

  /** 与 StockDomain.calCntWithFee 一致 */
  static calCntWithFee(stockCnt: StockCntVo, targetFee: { buyUnitFee: number }, col = 'cnt'): number {
    if (stockCnt == null) {
      return 0;
    }
    const stockNum = stockCnt[col] ?? stockCnt.cnt;
    if (stockNum == null) {
      return 0;
    }
    if (stockCnt.buyUnitFee === targetFee.buyUnitFee) {
      return stockNum;
    }
    const calers = [
      new Caler(stockCnt.buyUnitFee, true),
      new Caler(targetFee.buyUnitFee, false)
    ].sort((a, b) => a.getSortValue() - b.getSortValue());
    let num = stockNum;
    for (const caler of calers) {
      num = caler.cal(num);
    }
    return num;
  }

  /** 与 StockDomain.calPriceWithFee 一致 */
  static calPriceWithFee(price1: StockPriceVo, price2: { buyUnitFee: number }): StockPriceVo {
    return {
      price: new Fraction(price2.buyUnitFee, price1.buyUnitFee).cal(price1.price),
      buyUnitFee: price2.buyUnitFee
    };
  }

  /** 与 StockDomain.isEq 一致 */
  static isEq(cnt: StockCntVo, pojo: StockCntVo): boolean {
    const minStock = this.selectMinBuyUnitFeeStockCnt(cnt, pojo);
    return this.calCntWithFee(cnt, minStock) === this.calCntWithFee(pojo, minStock);
  }

  /** 与 StockDomain.isEqPrice 一致 */
  static isEqPrice(price1: StockPriceVo, price2: StockPriceVo): boolean {
    const price = this.calPriceWithFee(price1, price2);
    return this.isNumEq(price2.price, price.price);
  }

  /** 主单 noteItem → 库存 StockCntVo（instockCnt + buyUnitFee） */
  static storeStockFromNoteItem(item: any): StockCntVo {
    return {
      cnt: item.instock.cnt,
      buyUnitFee: item.instock.buyUnitFee
    };
  }

  /** 主单 noteItem → 价格 StockPriceVo（price + stockBuyUnitFee） */
  static storePriceFromNoteItem(item: any): StockPriceVo {
    return {
      price: item.price,
      buyUnitFee: item.stockBuyUnitFee
    };
  }

  /** 链接单 noteItem → 库存 StockCntVo（linkInstockCnt + buyUnitFee） */
  static linkStockFromNoteItem(item: any): StockCntVo {
    return {
      cnt: item.linkInstockCnt.cnt,
      buyUnitFee: item.linkInstockCnt.buyUnitFee
    };
  }

  /** 链接单 noteItem → 价格 StockPriceVo（linkPrice + linkStockBuyUnitFee） */
  static linkPriceFromNoteItem(item: any): StockPriceVo {
    const linkPrice = item.linkPrice ?? {};
    return {
      price: linkPrice.price,
      buyUnitFee: linkPrice.buyUnitFee ?? item.linkStockBuyUnitFee
    };
  }
}

class Caler {
  private buyUnitFee: number;
  private oper: '*' | '/';

  constructor(buyUnitFee: number, self: boolean) {
    if (buyUnitFee == null || Number.isNaN(buyUnitFee)) {
      throw new Error('数据不合法，不能计算');
    }
    this.buyUnitFee = buyUnitFee;
    if (buyUnitFee > 0) {
      this.oper = self ? '/' : '*';
    } else {
      this.oper = self ? '*' : '/';
    }
  }

  cal(num: number) {
    if (this.buyUnitFee === 1) {
      return num;
    }
    if (this.oper === '*') {
      return num * Math.abs(this.buyUnitFee);
    }
    return num / Math.abs(this.buyUnitFee);
  }

  getSortValue() {
    return this.oper === '*' ? 0 : 1;
  }
}

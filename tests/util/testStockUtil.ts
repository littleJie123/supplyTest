import StockUtil from '../../src/util/StockUtil';

describe('StockUtil', () => {
  describe('isNumEq / gcd / lcm', () => {
    it('isNumEq 容忍浮点误差', () => {
      expect(StockUtil.isNumEq(1, 1)).toBe(true);
      expect(StockUtil.isNumEq(0.1 + 0.2, 0.3)).toBe(true);
      expect(StockUtil.isNumEq(1, 2)).toBe(false);
    });

    it('gcd / lcm', () => {
      expect(StockUtil.gcd(12, 8)).toEqual(4);
      expect(StockUtil.lcm(4, 6)).toEqual(12);
      expect(StockUtil.lcm(0, 5)).toEqual(0);
    });
  });

  describe('buildMinBuyUnitFee', () => {
    it('两边为正取 lcm', () => {
      expect(StockUtil.buildMinBuyUnitFee(4, 6)).toEqual(12);
    });

    it('两边为负取 -gcd，-1 变成 1', () => {
      expect(StockUtil.buildMinBuyUnitFee(-10, -15)).toEqual(-5);
      expect(StockUtil.buildMinBuyUnitFee(-1, -1)).toEqual(1);
    });

    it('一正一负取 max', () => {
      expect(StockUtil.buildMinBuyUnitFee(-10, 5)).toEqual(5);
    });

    it('fee为0抛错', () => {
      expect(() => StockUtil.buildMinBuyUnitFee(0, 1)).toThrow('fee 不能为0');
    });
  });

  describe('calCntWithFee', () => {
    it('同 fee 直接返回', () => {
      expect(StockUtil.calCntWithFee({ cnt: 3, buyUnitFee: 1 }, { buyUnitFee: 1 })).toEqual(3);
    });

    it('正 fee：1箱12瓶 → 标准瓶', () => {
      // {cnt:1, buyUnitFee:-12} 表示 12 瓶，转到 buyUnitFee:1 → 12
      expect(StockUtil.calCntWithFee({ cnt: 1, buyUnitFee: -12 }, { buyUnitFee: 1 })).toEqual(12);
    });

    it('正 fee 除法：1/10 标准单位', () => {
      expect(StockUtil.calCntWithFee({ cnt: 1, buyUnitFee: 10 }, { buyUnitFee: 1 })).toEqual(0.1);
    });

    it('null 返回 0', () => {
      expect(StockUtil.calCntWithFee(null as any, { buyUnitFee: 1 })).toEqual(0);
    });
  });

  describe('isEq / isEqPrice', () => {
    it('isEq：不同 fee 表示同一数量时相等', () => {
      expect(StockUtil.isEq(
        { cnt: 1, buyUnitFee: -12 },
        { cnt: 12, buyUnitFee: 1 }
      )).toBe(true);
      expect(StockUtil.isEq(
        { cnt: 1, buyUnitFee: 1 },
        { cnt: 2, buyUnitFee: 1 }
      )).toBe(false);
    });

    it('isEqPrice：换算后价格相等', () => {
      expect(StockUtil.isEqPrice(
        { price: 10, buyUnitFee: 1 },
        { price: 10, buyUnitFee: 1 }
      )).toBe(true);
      // 半瓶 5 元 vs 1瓶 10 元
      expect(StockUtil.isEqPrice(
        { price: 5, buyUnitFee: 2 },
        { price: 10, buyUnitFee: 1 }
      )).toBe(true);
    });
  });

  describe('fromNoteItem helpers', () => {
    it('storeStockFromNoteItem / storePriceFromNoteItem', () => {
      const item = {
        instock: { cnt: 2, buyUnitFee: -10 },
        price: 21,
        stockBuyUnitFee: 1
      };
      expect(StockUtil.storeStockFromNoteItem(item)).toEqual({ cnt: 2, buyUnitFee: -10 });
      expect(StockUtil.storePriceFromNoteItem(item)).toEqual({ price: 21, buyUnitFee: 1 });
    });

    it('linkStockFromNoteItem / linkPriceFromNoteItem', () => {
      const item = {
        linkInstockCnt: { cnt: 0.002, buyUnitFee: 1 },
        linkPrice: { price: 0.2, buyUnitFee: 500 },
        linkStockBuyUnitFee: 500
      };
      expect(StockUtil.linkStockFromNoteItem(item)).toEqual({ cnt: 0.002, buyUnitFee: 1 });
      expect(StockUtil.linkPriceFromNoteItem(item)).toEqual({ price: 0.2, buyUnitFee: 500 });
    });

    it('linkPrice 缺 buyUnitFee 时回退 linkStockBuyUnitFee', () => {
      expect(StockUtil.linkPriceFromNoteItem({
        linkPrice: { price: 3 },
        linkStockBuyUnitFee: 7
      })).toEqual({ price: 3, buyUnitFee: 7 });
    });
  });
});

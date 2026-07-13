import NoteItemUtil from '../../src/util/NoteItemUtil';

describe('NoteItemUtil', () => {
  describe('notEq', () => {
    it('差值小于阈值视为相等', () => {
      expect(NoteItemUtil.notEq(1, 1)).toBe(false);
      expect(NoteItemUtil.notEq(1, 1.0000001)).toBe(false);
      expect(NoteItemUtil.notEq(1, 2)).toBe(true);
    });
  });

  describe('buildCntAndPrice', () => {
    it('按 cntCol / priceCol 转成标准单位数量与价格', () => {
      const content = [{
        name: '猪肉',
        noteItemId: 1,
        linkNoteItemId: 2,
        stockBuyUnitFee: 1,
        price: 21,
        purcharse: { cnt: 2, buyUnitFee: -10 }
      }];
      const list = NoteItemUtil.buildCntAndPrice(content, 'purcharse');
      expect(list).toHaveLength(1);
      expect(list[0].name).toEqual('猪肉');
      expect(list[0].noteItemId).toEqual(1);
      // Fraction(-10,1).cal(2) = 2*10 = 20
      expect(list[0].cnt).toEqual(20);
      // Fraction(1,1).cal(21) = 21
      expect(list[0].price).toEqual(21);
    });

    it('指定 priceCol=linkPrice 时用链接价', () => {
      const content = [{
        name: '羊肉',
        noteItemId: 3,
        linkNoteItemId: 4,
        stockBuyUnitFee: 1,
        price: 999,
        linkPrice: { price: 0.2, buyUnitFee: 1 },
        instock: { cnt: 1, buyUnitFee: 1 }
      }];
      const list = NoteItemUtil.buildCntAndPrice(content, 'instock', 'linkPrice');
      expect(list[0].cnt).toEqual(1);
      // price 来自 linkPrice.price，stockBuyUnitFee 仍用 row.stockBuyUnitFee=1
      expect(list[0].price).toEqual(0.2);
    });
  });

  describe('change / changeOne', () => {
    it('把 listNoteItem 结构转成更新入参字段', () => {
      const item = {
        noteItemId: 11,
        materialId: 22,
        purcharse: { cnt: 3, buyUnitFee: 1 },
        instock: { cnt: 3, buyUnitFee: 1 },
        sendCnt: { cnt: 2, buyUnitFee: 1 },
        supplierMaterial: { price: 15, buyUnitFee: -10 }
      };
      const ret = NoteItemUtil.changeOne(item);
      expect(ret).toEqual({
        noteItemId: 11,
        materialId: 22,
        cnt: 3,
        instockCnt: 3,
        sendCnt: 2,
        price: 15,
        stockBuyUnitFee: -10
      });
      expect(NoteItemUtil.change([item])).toHaveLength(1);
    });
  });

  describe('checkCntAndPrice', () => {
    it('无 map 系数时数量价格需一致', () => {
      // join: content.noteItemId ↔ expected.linkNoteItemId
      const content = [{
        name: '猪肉',
        noteItemId: 1,
        linkNoteItemId: 2,
        stockBuyUnitFee: 1,
        price: 10,
        purcharse: { cnt: 1, buyUnitFee: 1 },
        linkPrice: { price: 10 }
      }];
      const expected = [{
        name: '猪肉',
        linkNoteItemId: 1,
        cnt: 1,
        price: 10
      }];
      expect(() => NoteItemUtil.checkCntAndPrice(content, expected, {}, 'purcharse')).not.toThrow();
    });

    it('有 map 系数时按 Fraction 换算', () => {
      // fee=10 → Fraction(1,10).cal(x)=10x
      // 要求：10*row.cnt==row2.cnt，且 row.price==10*row2.price
      const content = [{
        name: '羊肉',
        noteItemId: 1,
        linkNoteItemId: 2,
        stockBuyUnitFee: 1,
        price: 10,
        purcharse: { cnt: 10, buyUnitFee: 1 },
        linkPrice: { price: 10 }
      }];
      const expected = [{
        name: '羊肉',
        linkNoteItemId: 1,
        cnt: 100,
        price: 1
      }];
      expect(() => NoteItemUtil.checkCntAndPrice(content, expected, { 羊肉: 10 }, 'purcharse')).not.toThrow();
    });

    it('不一致时抛错', () => {
      const content = [{
        name: '猪肉',
        noteItemId: 1,
        linkNoteItemId: 2,
        stockBuyUnitFee: 1,
        price: 10,
        purcharse: { cnt: 1, buyUnitFee: 1 },
        linkPrice: { price: 10 }
      }];
      const expected = [{
        name: '猪肉',
        linkNoteItemId: 1,
        cnt: 99,
        price: 10
      }];
      expect(() => NoteItemUtil.checkCntAndPrice(content, expected, {}, 'purcharse')).toThrow(/价格或者数量不对/);
    });
  });
});

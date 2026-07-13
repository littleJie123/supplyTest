import MaterialLinkUtil from '../../src/util/MaterialLinkUtil';

describe('MaterialLinkUtil', () => {
  describe('format', () => {
    function run(src: { unitFee: number; linkUnitFee: number }, target: { unitFee: number; linkUnitFee: number }) {
      const result = MaterialLinkUtil.format(src);
      expect(result.unitFee).toEqual(target.unitFee);
      expect(result.linkUnitFee).toEqual(target.linkUnitFee);
    }

    it('两边都为正时原样返回', () => {
      run({ unitFee: 10, linkUnitFee: 4 }, { unitFee: 10, linkUnitFee: 4 });
      run({ unitFee: 1, linkUnitFee: 500 }, { unitFee: 1, linkUnitFee: 500 });
    });

    it('一边为负时转成正数比例', () => {
      run({ unitFee: 10, linkUnitFee: -4 }, { unitFee: 40, linkUnitFee: 1 });
      run({ unitFee: -10, linkUnitFee: 4 }, { unitFee: 1, linkUnitFee: 40 });
    });

    it('两边都为负时交换并取正', () => {
      run({ unitFee: -10, linkUnitFee: -4 }, { unitFee: 4, linkUnitFee: 10 });
    });

    it('两边为0时变成1:1', () => {
      run({ unitFee: 0, linkUnitFee: 0 }, { unitFee: 1, linkUnitFee: 1 });
    });
  });

  describe('parseCnt', () => {
    it('unitFee:10 linkUnitFee:1 时 3→30', () => {
      expect(MaterialLinkUtil.parseCnt({ unitFee: 10, linkUnitFee: 1 }, 3)).toEqual(30);
    });

    it('主单1链接500：1标准主单→1/500链接', () => {
      expect(MaterialLinkUtil.parseCnt({ unitFee: 1, linkUnitFee: 500 }, 1)).toEqual(1 / 500);
    });

    it('主单-10链接1：1主单→0.1链接', () => {
      expect(MaterialLinkUtil.parseCnt({ unitFee: -10, linkUnitFee: 1 }, 1)).toEqual(0.1);
    });

    it('1:1 时数量不变', () => {
      expect(MaterialLinkUtil.parseCnt({ unitFee: 1, linkUnitFee: 1 }, 7)).toEqual(7);
    });

    it('cnt为null时返回0', () => {
      expect(MaterialLinkUtil.parseCnt({ unitFee: 1, linkUnitFee: 1 }, null as any)).toEqual(0);
    });
  });

  describe('parsePriceFee', () => {
    function run(
      link: { unitFee: number; linkUnitFee: number },
      sm: { price: number; buyUnitFee: number },
      ret: { price: number; buyUnitFee: number }
    ) {
      const result = MaterialLinkUtil.parsePriceFee(link, sm);
      expect(result.buyUnitFee).toEqual(ret.buyUnitFee);
      expect(result.price).toEqual(ret.price);
    }

    it('对齐 MaterialLinkDomain.parsePriceFee 用例', () => {
      run({ unitFee: 10, linkUnitFee: 1 }, { price: 10, buyUnitFee: -10 }, { price: 10, buyUnitFee: -100 });
      run({ unitFee: 7, linkUnitFee: 1 }, { price: 10, buyUnitFee: 7 }, { price: 10, buyUnitFee: 1 });
      run({ unitFee: 7, linkUnitFee: 1 }, { price: 10, buyUnitFee: 1 }, { price: 10, buyUnitFee: -7 });
      run({ unitFee: 1, linkUnitFee: 1 }, { price: 10, buyUnitFee: -7 }, { price: 10, buyUnitFee: -7 });
      run({ unitFee: -7, linkUnitFee: 1 }, { price: 10, buyUnitFee: -7 }, { price: 10, buyUnitFee: 1 });
    });
  });

  describe('changeLinkFee', () => {
    it('合并比例并约分', () => {
      const result = MaterialLinkUtil.changeLinkFee(
        { unitFee: 2, linkUnitFee: 1 },
        { unitFee: 3, linkUnitFee: 1 }
      );
      expect(result).toEqual({ unitFee: 6, linkUnitFee: 1 });
    });
  });
});

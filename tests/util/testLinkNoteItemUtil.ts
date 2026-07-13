import LinkNoteItemUtil from '../../src/util/LinkNoteItemUtil';

describe('LinkNoteItemUtil', () => {
  function buildPair(opt?: {
    storeCnt?: number;
    storeFee?: number;
    linkCnt?: number;
    linkFee?: number;
    storePrice?: number;
    storePriceFee?: number;
    linkPrice?: number;
    linkPriceFee?: number;
    storeLinkUnitFee?: number;
    supplierLinkUnitFee?: number;
    cost?: number;
  }) {
    const storeLinkUnitFee = opt?.storeLinkUnitFee ?? 1;
    const supplierLinkUnitFee = opt?.supplierLinkUnitFee ?? 1;
    const storeCnt = opt?.storeCnt ?? 1;
    const storeFee = opt?.storeFee ?? 1;
    const linkCnt = opt?.linkCnt ?? storeCnt;
    const linkFee = opt?.linkFee ?? storeFee;
    const storePrice = opt?.storePrice ?? 10;
    const storePriceFee = opt?.storePriceFee ?? 1;
    const linkPrice = opt?.linkPrice ?? storePrice;
    const linkPriceFee = opt?.linkPriceFee ?? storePriceFee;
    const cost = opt?.cost ?? 10;

    return {
      store: {
        name: '猪肉',
        instock: { cnt: storeCnt, buyUnitFee: storeFee },
        price: storePrice,
        stockBuyUnitFee: storePriceFee,
        linkUnitFee: storeLinkUnitFee,
        instockCost: cost
      },
      supplier: {
        name: '猪肉',
        linkInstockCnt: { cnt: linkCnt, buyUnitFee: linkFee },
        linkPrice: { price: linkPrice, buyUnitFee: linkPriceFee },
        linkUnitFee: supplierLinkUnitFee,
        linkInstockCost: cost
      }
    };
  }

  it('1:1 比例时库存价格金额一致可通过', () => {
    const { store, supplier } = buildPair();
    expect(() => LinkNoteItemUtil.compareStoreAndLink(store, supplier)).not.toThrow();
  });

  it('主单1链接500：按 parseCnt 换算后可通过', () => {
    const { store, supplier } = buildPair({
      storeCnt: 1,
      storeFee: 1,
      storeLinkUnitFee: 1,
      supplierLinkUnitFee: 500,
      linkCnt: 1 / 500,
      linkFee: 1,
      storePrice: 10,
      storePriceFee: 1,
      // parsePriceFee({1,500}, {10,1}) → {price:10, buyUnitFee:500}
      linkPrice: 10,
      linkPriceFee: 500,
      cost: 10
    });
    expect(() => LinkNoteItemUtil.compareStoreAndLink(store, supplier)).not.toThrow();
  });

  it('缺少 linkUnitFee 时抛错', () => {
    const { store, supplier } = buildPair();
    delete (store as any).linkUnitFee;
    expect(() => LinkNoteItemUtil.compareStoreAndLink(store, supplier)).toThrow();
  });

  it('库存不匹配时抛错', () => {
    const { store, supplier } = buildPair({ linkCnt: 999 });
    expect(() => LinkNoteItemUtil.compareStoreAndLink(store, supplier)).toThrow(/库存不相等/);
  });

  it('linkInstockCost 与 instockCost 不一致时抛错', () => {
    const { store, supplier } = buildPair();
    supplier.linkInstockCost = 999;
    expect(() => LinkNoteItemUtil.compareStoreAndLink(store, supplier)).toThrow(/linkInstockCost/);
  });
});

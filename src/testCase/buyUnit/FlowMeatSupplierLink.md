# 简介
基于 `PreTestWithMeatAndSupplier`（餐厅 1包=100克，供应商羊包/牛克单单位；首单发单接单），覆盖订单全链路操作，并在**每一步后校验餐厅与供应商两端数量**（经 `linkUnitFee` 换算）。

# 测试步骤
1. **前置**：`PreTestWithMeatAndSupplier`（肉类规格、供应商仓、首单 create → send → 分享接单）。
2. **首单创建/发送/接单后**：双端比对 `purcharse`；校验羊包/牛克单位与 `linkNoteItemId`（期望：羊1、牛100）。
3. **供应商发货**：供应商仓 `processNote(send)`，发货量=采购量；双端比对 `sendCnt`。
4. **供应商出库**：供应商仓 `processNote(instock)`，出库量=发货量；供应商验 `instock≈purcharse`，餐厅验 `linkInstockCnt`（与供应商 instock 换算一致）。**注意**：供应商出库后餐厅看的是 `linkInstockCnt`，不是本方 `instock`。
5. **第二单创建**：餐厅再 `createNote`（羊1包 + 牛50克）——已链接则自动出链接单；双端比对 `purcharse` + 单位。
6. **第二单发送**：`sendNote`；再双端比对 `purcharse`（发送不改变采购量）。
7. **餐厅入库**：餐厅 `processNote(instock)`，入库量=采购量；用 `LinkNoteItemUtil.compareStoreAndLink`（餐厅 `instock` ↔ 供应商 `linkInstockCnt`）。

# 注意点
- 业务规则：首次关联后后续发单自动 `linkNotes`，只有第一单需要分享/接单；自动链接单在供应商侧初始为未接单，本用例第二单走餐厅入库，不要求供应商再 accept/send。
- 字段视角：餐厅本方看 `instock*`；供应商出库同步到餐厅的是 `linkInstock*`；供应商本方出库看 `instock`。
- 数量比较：`materialLink = { unitFee: 主单.linkUnitFee, linkUnitFee: 链接单.linkUnitFee }`（出库反向则以供应商为源），再 `MaterialLinkUtil.parseCnt` + `StockUtil.isEq`。
- 依赖变量见 `PreTestWithMeatAndSupplier.md`（`meatLinkOrder`、`meatLinkNoteId`、`meatLinkLinkNoteId` 等）；第二单用 `meatLinkNoteId2` / `meatLinkLinkNoteId2`。
- 规格：**餐厅侧**羊/牛都是 `1包=100克`（羊按包下单、牛按克下单）；**供应商侧**羊肉只有「包」、牛肉只有「克」，各一个单位。

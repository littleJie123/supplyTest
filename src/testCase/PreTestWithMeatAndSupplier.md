# 简介
在 `PreTestWithMeat` 基础上注册供应商仓。**餐厅侧**羊肉、牛肉规格均为 `1包=100克`（默认采购单位：羊=包、牛=克）；**供应商侧**只有一个单位：羊肉「包」、牛肉「克」。餐厅按默认单位向供应商1发单并完成首次接单链接。

# 测试步骤
1. **前置肉类**：`PreTestWithMeat`（羊/牛 1包=100克，猪为克）。
2. **对齐餐厅默认采购单位**：`updateMaterial` — 羊肉规格 克(1)+包(100)、默认 **包@200**；牛肉规格 克(1)+包(100)、默认 **克@2**。
3. **`listMaterialByCategory`**：记下羊/牛默认 `stockUnitsId`、价、`buyUnitFee`（变量 `meatLinkOrder`）。
4. **注册供应商仓**：`AddWarehouse` → `supplierWarehouse`（肉类链接供应商仓）。
5. **供应商侧物料**：`SaveMaterial` — 羊肉仅「包」、牛肉仅「克」，**各只有一个单位**，不做 1包=100克 的多级规格。
6. **餐厅发单**：`createNote` 羊肉1包 + 牛肉100克（供应商1）→ `sendNote`。
7. **分享接单**：`SaveShareData` → `shareNote` → 切供应商仓 → `linkNote` → 切回餐厅。
8. **校验**：餐厅单有 `linkNoteId`；明细两行单位分别为包/克，且均有 `linkNoteItemId`。

# 注意点
- 变量：`supplierWarehouse`、`meatLinkNoteId` / `meatLinkNoteIds`、`meatLinkLinkNoteId`、`meatLinkOrder`、`meatLinkNoteItemIds`、`meatLinkLinkNoteItemIds`。
- 餐厅侧羊肉标准单位=克、按包下单 `buyUnitFee=-100`；牛肉标准单位=包、按克下单 `buyUnitFee` 取默认 SM 的值。
- 供应商侧单规格：羊肉标准单位就是包、牛肉就是克，`buyUnitFee=1`；两端换算靠 `noteItem.linkUnitFee`。
- 仅第一单需分享/接单；后续同供应商发单会自动出链接单。

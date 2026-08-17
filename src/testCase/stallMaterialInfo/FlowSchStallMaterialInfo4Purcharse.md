# 简介
测试 `/app/stallMaterialInfo/schStallMaterialInfo4Purcharse`：按仓库查出订货暂存（`stallMaterialInfo.type=purcharse`），挂规格与默认供应商物料价，返回 `content` + 合计 `money`；下单发送后暂存应清空。

# 测试步骤
1. 引用 `PreTest`（餐厅、供应商1/2、猪肉/羊肉/牛肉等）。
2. 调 `schStallMaterialInfo4Purcharse`：尚无订货 → `content` 为空、`money=0`。
3. `addPurcharse` 仅牛肉：`cnt=50`、`buyUnitFee=1`。
4. 再查订货数据：1 条；`stock` 为 50/1；有 `supplierMaterial`、有 `buyUnit`；无 `supplier`（`noSupplier`）、无 `stallStocks`；`money=500`（单价 10）。
5. 再订猪肉（400/1）、羊肉（30/500）。
6. 再查：3 条，数量与步骤一致；`money` 按返回的 `stock`+`supplierMaterial` 用与服务端相同的 fee 换算后合计。
7. `CreateNote3M`（createNote → sendNote）：发送时清空对应物料的订货暂存。
8. 再查：`content` 为空、`money=0`。

# 注意点
- 接口必参仅 `warehouseId`；用例用 `Action` 顺带带上 `warehouseGroupId`。
- 行上无 `name`（`MaterialAndUnitsHat` 传了 `noSchMaterial`），断言用 `materialMap` 的 `materialId`。
- `SupplierMaterialHat` 传了 `noSupplier`，校验不要期望 `supplier` 对象。
- `money` 用 `StockDomain.calMoney` 逻辑（fee 正除负乘），测试里用同规则从返回行重算，避免写死易碎金额。

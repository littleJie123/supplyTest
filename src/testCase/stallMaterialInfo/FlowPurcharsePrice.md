# 简介
测试订货暂存自定义价格和供应商：`addPurcharseByMaterials` 可带 `price`/`stockBuyUnitFee`/`supplierId`（均可为空）；`schStallMaterialInfo4Purcharse` 已有价格和供应商则不再查 Hat，缺一则 Hat 补全且不覆盖；多档口以有效的最后一条为准。

# 测试步骤
1. 引用 `PreTest`（餐厅、供应商1/2、猪肉/羊肉/牛肉/白菜等）。
2. `addPurcharseByMaterials` 订牛肉 50，不传价格和供应商；再查：`supplierMaterial.price=10`（默认）、供应商2、`money` 含 500。两个接口向前兼容。
3. 新增档口A、档口B，`listStall` 写入 `stallMap`。
4. 档口A 订猪肉 `cnt=10`、价 8、供应商1；再档口B 订猪肉 `cnt=20`、价 9、供应商2。
5. 再查猪肉：数量合计 30；价格/供应商取最后有效的档口B（价 9、供应商2），不是默认价 21。
6. 羊肉只传价 30（不传供应商）：查询价 30、供应商由 Hat 补为供应商1。
7. 羊肉只传供应商2（不传价格）：查询价仍 30、供应商改为 2。
8. 白菜只传供应商2（不传价格）：查询默认价 21、供应商2。
9. 白菜只传价 18（不传供应商）：查询价 18、供应商仍为 2。

# 注意点
- 批量订货走 `/app/noteItem/addPurcharseByMaterials`，不要用单条 `addPurcharse`。
- 物料名在行上扁平字段 `name`（与 `listMaterialByCategory` 一致）；定位仍可用 `materialMap` 的 `materialId`。
- 供应商名在 `supplier.name`，同时断言 `supplierMaterial.supplierId`。
- 多档口用 `stallStocks`；查询结果会删掉 `stallStocks`，数量为各档口合计。
- 默认价：牛肉 10（供应商2）；猪肉/羊肉/白菜 21（供应商1）。

# 简介
验证订单金额四舍五入：西瓜规格 `1千克=1000g`，单价 `3.5` 元/千克，订货 `9千克50克`（9.05 千克）。

`9.05 × 3.5 = 31.675`，保留两位小数应四舍五入为 **31.68**（不能落成 31.67）。该场景容易踩到浮点误差（`9.05 * 3.5 === 31.674999…`）。

# 测试步骤
1. 引用 `PreTest`：只建西瓜。规格克 + 千克（`fee=1000`，采购单位千克），默认价 `3.5/千克`。
2. `listMaterialByCategory`：记下西瓜 `materialId`、`stockUnitsId`、克/千克对应 `buyUnitFee`、默认价。
3. `createNote`：数量按 9050 克提交（`cnt=9050`，`buyUnitFee` 为克相对标准单位的比例），单价走默认 SM。
4. 校验 `createNote` 返回、`listNote`、`listNoteItem`、`free/query` 库表：
   - 订单 / 明细金额 `cost=31.68`
   - 数量等价于 9 千克 50 克（`StockUtil.isEq`）
   - 单价等价于 3.5 元/千克（`StockUtil.isEqPrice`）

# 注意点
- 金额用 `cost` 断言（`31.68`），不要用截断后的 `31.67`。
- 价格、数量比较走 `StockUtil.isEqPrice` / `StockUtil.isEq`，不要对 `price` / `cnt` 直接 `expectEqual`。
- 克/千克的 `unitsId` 与 `buyUnitFee` 从接口读取，禁止写死。

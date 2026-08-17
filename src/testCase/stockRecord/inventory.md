# 简介
验证空物料直接盘成 0 后再盘成 1 包 100 元，库存数量和金额都正确（覆盖 `filter4Change` 滤掉 `cnt=0/cost=0` 导致盘点不生效的问题）。

# 测试步骤
1. **前置**：`PreTest` 创建仓库/供应商，仅物料「牛肉」（初始单位「包」）。
2. **直接盘成 0**：`setInventoryByArray`，牛肉 `cnt=0`、`buyUnitFee=1`、`cost=0`（前面没有任何入库/盘点）。
3. **校验盘 0**：`Recal` → `CheckStock` 数量 0 包 → `CheckArray` 金额 0。
4. **再盘成 1 包 100 元**：`setInventoryByArray`，牛肉 `cnt=1`、`buyUnitFee=1`、`cost=100`。
5. **校验盘 1 包**：`Recal` → `CheckStock` 数量 1 包 → `CheckArray` 金额 100。

# 注意点
- 不指定 `bussinessDate`，走当天盘点（`stockDomain.set` 增量入账），用来覆盖「空库存盘 0」这条路径。
- 牛肉标准单位是包，按包盘点 `buyUnitFee=1`。
- 校验步骤含 Recal + CheckStock + CheckArray，收成嵌套 TestCase；两次盘点都是单接口 Action。

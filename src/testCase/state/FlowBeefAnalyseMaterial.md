# 简介
测试牛肉物料（标准单位=包，1包=100克）在**不同 buyUnitFee**（克=`100`、包=`1`）下，盘点/入库/销售/退货后的库存 FIFO，以及期末盘零后 `/app/state/analysyMaterial` 的用量差异。

# 测试步骤
1. PreTest 仅创建牛肉（初始单位「包」）+ 供应商等基础数据
2. `saveBuyUnit` 改为 1包=100克（保留「包」为单位）
3. 增加餐品「红烧牛肉」，BOM：每份牛肉 **10g（`buyUnitFee=100`）**，理论价 **1元/g（`stockBuyUnitFee=100`）**
4. 7月1日盘点：牛肉 **`cnt=30, buyUnitFee=100` / 30元**（按克）
5. 7月2日订单入库：createNote → sendNote → processNote，牛肉 **`cnt=3, buyUnitFee=1` / 450元**（按包）；再 `updateNoteTime` 改到 7/2
6. Recal 重算
7. 7月3日上传销售：红烧牛肉 **12份** → 消耗 **120g**（BOM 10g×12，fee100）
8. 7月4日从该订单退货 **1包（fee1）**，`updateNoteTime` 改到 7/4；Recal
9. 检查库存：**`cnt=110, buyUnitFee=100` / 165元**（FIFO，按克校验）
10. 7月30日盘点设为 **0（`buyUnitFee=100`）**；Recal
11. 调用 `/app/state/analysyMaterial`（begin=2026-07-01，end=2026-07-30），校验牛肉行差异字段

# 注意点
- **buyUnitFee 约定**：盘点、销售（含 BOM）用 **100（克）**；入库、退货用 **1（包）**
- 入库必须走订单流程再改业务日；改时间用 `/app/note/updateNoteTime`
- FIFO：销售先扣 7/1 盘点批次(30g/30元)，再扣入库(90g/135元)；退货再扣入库剩余(1包/150元)
- analysyMaterial 只统计 `sales` + `inventory`；入库/退货不进该接口，但会影响期末盘点差额分摊
- 期望（牛肉行）：`hasBeginInventory/hasEndInventory=true`，`cost=300`，`theoryCost=120`，`diff=180`，`diffByCnt=80`，`diffByPrice=100`

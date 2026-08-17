# 简介
测试按日期删除上月末盘点：先盘点、再按**其他价格**入库、再销售（消耗低于入库），打 `analysyMaterial`；删除上月末盘点后再打一次，用两次结果差验证盘点流水已删除且剩余流水已按 FIFO 重算。

# 测试步骤
1. **前置**：`PreTest` 仅创建牛肉（初始单位「包」）+ `saveBuyUnit` 转为 1包=100克
2. **餐品 BOM**：红烧牛肉，每份 **10g**（`buyUnitFee=100`），理论价 **1元/g**
3. **上月末盘点**（5/31）：牛肉 **100g / 100元**（1元/g，`buyUnitFee=100`）
4. **入库**（6/2，其他价格）：createNote → sendNote → processNote，牛肉 **3包 / 600元**（2元/g，`buyUnitFee=1`）；再 `updateNoteTime` 改到 6/2
5. **销售**（6/10）：红烧牛肉 **15份** → 消耗 **150g**（低于入库 300g）
6. **第一次 analysyMaterial**（begin=5/31，end=6/30）：有期初盘点；销售 FIFO 先扣盘点 100g@1 再扣入库 50g@2
7. **删除上月末盘点**（`delInventoryByInventoryDay`，inventoryDay=2026-05-31）
8. **第二次 analysyMaterial**（同样区间）：无期初盘点；销售全部扣入库 @2元/g。对比两次：`hasBeginInventory` 变为否，`theoryCost` 不变，`cost` / `diff` 随 FIFO 批次变化

# 注意点
- 规格：标准单位=包；盘点/销售/BOM 用克 `buyUnitFee=100`；入库用包 `buyUnitFee=1`
- 入库必须走订单流程再改业务日；改时间用 `/app/note/updateNoteTime`
- 销售数量 150g **低于**入库 300g，删除盘点后仍有足够入库批次可扣，不会变成负库存干扰口径
- `analysyMaterial` 只统计 `sales` + `inventory`；入库不进该接口，但会通过 FIFO 改变销售流水的 `costOfChange`
- 删除会 `onDelInventory` → `recalByBeginStr`；两次 analysy 前都要 `Recal`（`runOnTime`）把重算落地
- FIFO / 用量口径推算见代码注释；第一次与第二次的差别即证明盘点流水已删且销售成本已重算

# 简介
验证 `/app/state/analyseSupplier`、`/app/state/analyseCategory` 只返回期间有过入库（含其他入库）或退货的维度；仅有期初、净入库为 0 的维度也要在「曾入过库又全退」时保留。

# 测试步骤
1. 引用 `PreTestWithMeat`（羊肉/猪肉标准单位克，牛肉标准单位包；羊牛 1包=100克）
2. **6月1日盘点**（`setInventoryByArray`）：牛肉2包、羊肉2包、猪肉200g，单价 **1元/g**，期初库存额合计 **600**（盘点一般挂 `supplierId=0`，展示名「门店自操作」）
3. **Recal**：刷盘点流水
4. **7月1日订单入库**：createNote → sendNote → processNote；牛肉1包、羊肉1包、猪肉100g，单价 **2元/g**（入库额合计 **600**）；再 `updateNoteTime` 改为 2026-07-01
5. **再 Recal**
6. 调用 `analyseSupplier`（2026-07-01~07-31）：应有「供应商1」且 `instockAmount=600`；**不应**出现仅有期初的「门店自操作」
7. 调用 `analyseCategory`：应有「肉类」且 `instockAmount=600`；列表中每行 `instockAmount`/`backAmount`/`handInstockAmount` 至少一项非 0
8. **全量退货**：从 7/1 订单退回等量物料，再 `updateNoteTime` 到 2026-07-15
9. **再 Recal**
10. 再调 `analyseSupplier`：仍应有「供应商1」（凭 `instockAmount`，证明不能只按净额过滤）；退货按 **FIFO** 扣 6/1 盘点批次，`backAmount` 落在「门店自操作」（非供应商1）；退货合计非 0
11. 再调 `analyseCategory`：仍应有「肉类」，且入库/退货金额列均非 0

# 注意点
- 过滤口径：`instockAmount`、`backAmount`、`handInstockAmount` 任一非 0 即保留，**不能**只看净入库金额
- 供应商维度 `backAmount` 按流水顶层 `supplierId` 汇总；退货扣库存走 FIFO，最旧批次是盘点（`supplierId=0`），故全退后「门店自操作」会因退货出现，不要期望退货金额记在下单单的供应商上
- 历史盘点 / 改单日期后都要 Recal
- 改订单/退货单时间用 `/app/note/updateNoteTime`
- 每个 Action / 嵌套 TestCase 都有 remark

# 简介
验证 `/app/state/analyseSupplier`、`/app/state/analyseCategory`：期间有过入库（含手动入库）或退货才返回；入库金额合并为单一字段；订单入库又全退时维度仍保留。

# 测试步骤
1. 引用 `PreTestWithMeat`（羊肉/猪肉标准单位克，牛肉标准单位包；羊牛 1包=100克）
2. **6月1日盘点**（`setInventoryByArray`）：牛肉2包、羊肉2包、猪肉200g，单价 **1元/g**，期初库存额合计 **600**（盘点一般挂 `supplierId=0`，展示名「门店自操作」）
3. **Recal**：刷盘点流水
4. **7月1日订单入库**：createNote → sendNote → processNote；牛肉1包、羊肉1包、猪肉100g，单价 **2元/g**（普通入库合计 **600**）；再 `updateNoteTime` 改为 2026-07-01
5. **再 Recal**
6. 调用 `analyseSupplier` / `analyseCategory`：供应商1、肉类 `instockAmount=600`；**不应**出现仅有期初的「门店自操作」；响应无 `backAmount` / `handInstockAmount`
7. **7月10日手动入库**（`createHandInstock`，`salesDay=2026-07-10`）：猪肉100g @2元/g，成本 **200**，供应商1
8. **再 Recal**
9. 再调两接口：供应商1、肉类 `instockAmount=800`（600+200）；仍无仅期初门店自操作
10. **全量退货**：从 7/1 订单退回等量物料，再 `updateNoteTime` 到 2026-07-15（不退手动入库）
11. **再 Recal**
12. 再调 `analyseSupplier`：供应商1仍为 **800**（退货未记在该供应商）；「门店自操作」`instockAmount=-300`（FIFO 按 6/1 盘点@1元/g 扣牛羊猪各100g）
13. 再调 `analyseCategory`：肉类 `instockAmount=500`（600+200−300），`endAmount=1100`（期初600+净入库500）

# 注意点
- 过滤在合并前按拆分字段：普通入库 / 手动入库 / 退货任一非 0 即保留，**不能**只看净入库金额
- 返回口径：`instockAmount = 普通入库 + 手动入库 − 退货`，删除 `backAmount` / `handInstockAmount`
- 手动入库 Action 不要写 `note` 变量（`createHandInstock` 也不返回单），退货仍针对 7/1 订单
- 供应商维度退货按流水顶层 `supplierId` 汇总；退货扣库存走 FIFO，最旧批次是盘点（`supplierId=0`）
- 历史盘点 / 改单日期后都要 Recal
- 改订单/退货单时间用 `/app/note/updateNoteTime`
- 每个 Action / 嵌套 TestCase 都有 remark

# 简介
验证四个 state 查询接口已改为基于 `stockRecord` 聚合：`stateMaterial`、`listStateWarehouse`、`analyseCategory`、`analyseSupplier`（并顺带核对 `stateWarehouse` 汇总一致）。

# 测试步骤
1. 引用 `PreTestWithMeat`（羊肉/猪肉标准单位克，牛肉标准单位包；羊牛 1包=100克）
2. **6月1日盘点**（`setInventoryByArray`）：牛肉2包、羊肉2包、猪肉200g，单价 **1元/g**，期初库存额合计 **600**
3. **Recal**（`/free/stateMaterial/recalStateMaterial`）：历史盘点只入队 timeServer，必须刷完才有 `costOfChange`/`afterStocks`
4. **7月1日订单入库**：createNote → sendNote → processNote；牛肉1包、羊肉1包、猪肉100g，单价 **2元/g**（入库额合计 **600**）；再 `updateNoteTime` 改为 2026-07-01
5. **再 Recal**：改单日期后的重算入队同样要刷完
6. 调用 `/app/state/stateMaterial`（begin/end=2026-07-01~07-31）：每个物料期初200、入库200、耗用0、期末400
7. 调用 `/app/state/listStateWarehouse`：2026-07-01 行期初600、入库600、耗用 amount=0、期末1200（同时有 `day`/`date`）
8. 调用 `/app/state/analyseCategory`：分类「肉类」期初600、入库600、耗用0、期末1200
9. 调用 `/app/state/analyseSupplier`：供应商1入库600；仅有盘点期初的「门店自操作」不返回；入库合计600
10. 调用 `/app/state/stateWarehouse`：仓库汇总与上列一致（期初600、入库600、耗用0、期末1200）

# 注意点
- 统计区间不依赖 `stateMaterial` 表读数，直接聚合 `stockRecord`；但历史盘点写入后仍依赖 **Recal** 把流水算完整
- 区间内无销售/盘点/报损，故耗用为0；期末=期初+入库
- 供应商维度：订单入库挂供应商1；盘点批次通常 `supplierId=0`（展示名「门店自操作」），但 analyseSupplier **只返回有入库/退货的维度**，故门店自操作不出现
- 改订单时间用 `/app/note/updateNoteTime`，不要用 `/free/update`
- 每个 Action / 嵌套 TestCase 都有 remark

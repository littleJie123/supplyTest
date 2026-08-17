# 简介
测试供应商与物料的报货日、在途日、千元用量字段的保存与查询。

# 测试步骤
1. 引用 PreTest（初始化餐厅、供应商、物料）
2. `updateSupplier`：供应商1 设为按周报货（`orderType=week`，`orderDay=1`），次日到（`daysInTransit=1`）
3. `listsupplier` 查询，期望供应商1 报货字段与步骤2一致
4. `SaveMaterial` 新增物料「测试千元用量」：供应商物料按月5日报货、2日在途；`safeStock.cnt=10`（单位斤）
5. `listMaterialByCategory` 查询，期望 `supplierMaterial` 报货字段为 month/5/2，挂载的 `supplier` 报货字段为 week/1/1，`safeStock.cnt=10`；并记下 unitsId 供千元用量使用
6. `updateMaterial`：报货改为每天（day/0/0）；`safeStock` 增加 `dosageCnt=3`、`dosageUnitsId`
7. `listMaterialByCategory` 再查，期望报货为 day/0/0，`dosageCnt=3`
8. `addsupplier` 新增「供应商千元用量」：按月10日报货、当天到（month/10/0）
9. `listsupplier` 查询，期望新供应商报货字段与步骤8一致

# 注意点
- `orderType`：`day` 每天 / `week` 按周 / `month` 按月 / `supplier` 和供应商一样（仅物料供应商关系）
- `orderDay`：每天为 0；按周为周几；按月为每月几号
- `daysInTransit`：0 当天到、1 次日到、其他为 N 日后到货
- 千元用量写在 `safeStock.dosageCnt` / `dosageUnitsId`，与安全库存一并保存
- 每个 Action 都有 remark；本流程每步仅 1 个接口调用，不包嵌套 TestCase

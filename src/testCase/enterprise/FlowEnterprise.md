# 简介
测试企业号：有无企业号、列表、改品牌名、增加仓库（受 cnt 限制）、逻辑删除仓库。

# 测试步骤
1. 数据初始化：`FindLastUserId` → `GetOpenId` → `AddWarehouse` → `ChangeWarehouse`，得到第一家门店。
2. 校验 `usersWarehouse`：创建人 `warehouseId=0`、`isAdmin=1`。
3. 有无企业号应为 false；企业号列表应为空（品牌 `cnt` 未开通）。
4. `/free/update` 把当前品牌 `cnt` 设为 2。
5. 有无企业号应为 true；企业号列表应有 1 条，且 id 为当前品牌。
6. 修改品牌名称为「企业号品牌」（参数走 `warehouse.warehouseGroupId` / `warehouse.name`）。
7. 企业号列表中该品牌名称应为「企业号品牌」。
8. 增加第二家门店「企业号门店2」（参数走 `warehouse.name` / `warehouse.warehouseGroupId`）。
9. 列出该品牌仓库，应有 2 家。
10. 删除第二家门店（`delEnterpriseWarehouse`，参数走 `warehouse.warehouseId` / `warehouse.warehouseGroupId`）；列表只剩 1 家，库中该仓库 `isDel=1`。
11. 再增加「企业号门店3」（删除后额度又够）；列表应有 2 家。

# 注意点
- 根节点 `warehouseGroupId` 是当前选中品牌，增/改/删目标记录必须放在 `warehouse` 里，不能用根节点 id。
- 删除企业号仓库是 `warehouse.isDel=1`，和原来的 `delWarehouse`（删 usersWarehouse）不同。
- 删改查不要求 admin，只要当前用户属于对应品牌/仓库；只有增加检查 `cnt` 是否够用。
- 每个 TestCase / Action 都有 `remark`。

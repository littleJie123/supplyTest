# 简介
测试分页选择装饰器 `SchIds`（见 `doc/分页选择.md`）：用 `_schParam` 按列表条件拉全量主键（或对象），验证 `_onlyId` 时不分页、不跑关联表后处理；`_notInIds` 反选排除；普通列表 **从第 1 页翻到最后一页**。

# 测试步骤
1. `/free/tests/listTestNumByTable` 按前缀查出可能残留的 id，再 `/free/del` 按 id 清理（无残留时 `in []` 查不到，不删）。
2. `/free/add` 插入 **12** 条 `test_num`：`schIdsPagSel_1`..`12`（val=10..120），记下 `testNumId`；预计算反选前 2 个 id。
3. **普通列表翻页（getTableName）** `/free/tests/listTestNumByTable`：`pageSize=3`、`orderBy=testNumId`，依次请求 `pageNo=1..4`：
   - 每页 3 条且 `linked=true`
   - 页间 id 不重复
   - 首页 = 最小 3 个 id；末页 = 最大 3 个 id
   - 4 页并集 = 全部 12 个 id
4. **普通列表翻页（getDao）** `/free/tests/listTestNumByDao`：同上，再翻一遍 1→4 页。
5. **SchIds 主键（getTableName）** `/free/tests/processSchIdsByTable`：`_schParam` 带 `pageSize=3` → 返回全部 **12** 个 `ids`（忽略分页）。
6. **SchIds 对象（getDao + needObj）** `/free/tests/processSchIdsByDao`：返回全部 12 条，含 `testNumId`，**无** `linked`。
7. **SchIds + `_notInIds` 反选（getTableName）**：排除前 2 个主键 → 剩余 **10** 个 id。
8. **SchIds + `_notInIds` 反选（getDao + needObj）**：同上 → 剩余 10 个对象，无 `linked`。
9. **无 `_schParam`**：再调 `processSchIdsByTable`，`ids` 为空（装饰器不改写）。
10. `/free/del` 按插入的 `testNumId` 删除测试数据。

# 注意点
- 查询桩：`ListTestNumByTable` 重写 `getTableName`；`ListTestNumByDao` 重写 `getDao`；二者 `_processList` 都打 `linked` / `linkName`。
- 处理桩：`ProcessSchIdsByTable` → `targetCol: ids`；`ProcessSchIdsByDao` → `needObj: true, targetCol: list`。
- `_onlyId` 时不分页、只查主键、跳过 `_processList`；`_notInIds` 非空时加「主键 not in」。
- 翻页用 `orderBy=testNumId` 保证首页/末页可断言；`pageSize=3`、共 4 页覆盖「第一页→最后一页」。
- 本用例用 `HttpAction`，并设 `variable.token = ''`（不需要 warehouseGroupId / 登录）。

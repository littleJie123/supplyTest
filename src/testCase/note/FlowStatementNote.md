# 简介
测试订单列表结算 / 取消结算：未结算（`instocked`）改为已结算（`statement`），再改回未结算。

# 测试步骤
1. 引用 `PreTest`：创建餐厅、供应商、物料。
2. 引用 `PreNote`：向供应商1下单猪肉，数量 10、单价 2，发单并入库。入库金额 `instockCost=20`。
3. `statmentNote`：结算金额改为 **88**（故意不等于入库金额 20）。
4. 检查库表：订单 `status=statement`、`statementCost=88`；`noteItem` 的 `statementCnt`/`statementCost` 等于 `instockCnt`/`instockCost`（10 / 20）。
5. `listNoteUpdateHis`：只记整单 `note`（`action=statement`，`remark=结算`，`detail=title`），**不写** noteItem。
6. `cancelStatmentNote`：取消结算。
7. 检查库表：订单 `status=instocked`、`statementCost=0`；`noteItem` 的 `statementCnt`/`statementCost` 为 null。
8. `listNoteUpdateHis`：只记整单 `note`（`action=cancelStatement`，`remark=取消结算`），**不写** noteItem。

# 注意点
- 每个步骤如果需要调用多次接口，请把它集合成 TestCase；只有 1 个 Action 时不要包成 TestCase。
- 每个 TestCase 或者 action 都要有备注说明该步骤执行的内容（detail 仅弹窗显示备注）。
- 结算金额用用户提交值，不要用明细 `statementCost` 之和去覆盖。本用例 88 ≠ 20，用来证明这一点。
- 明细结算数量/金额是把入库值抄过去，取消结算则清空为 null。
- 更改记录只记 note，查询走 `/app/updateHis/listNoteUpdateHis`。
- 接口路径按文档拼写：`/app/note/statmentNote`、`/app/note/cancelStatmentNote`。

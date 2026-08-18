# 简介
测试供应商应付账款下载接口 `/app/state/stateNote`。按 `createTime` 查已结算订单，按供应商汇总结算金额，并按供应商分 sheet 列出订单明细。退货单金额乘以 -1。

# 测试步骤
1. 引用 `PreTest`（餐厅、供应商1/供应商2、白菜/鸡蛋/牛肉等物料）。
2. **供应商1 正常入库（多物料）**：createNote → sendNote → processNote，白菜 10、鸡蛋 10，单价 20（入库金额 400，物料数量 2）；`updateNoteTime` 改为 2026-06-01；`setRate` 评分 5、评价「货好」。
3. **供应商1 手动入库**：`createHandInstock`，白菜 5 @20（入库金额 100，物料数量 1），`salesDay=2026-06-05`。
4. **供应商1 退货**：从步骤 2 订单退白菜 2 @20（入库金额 40，结算后 excel 为 -40）；`updateNoteTime` 改为 2026-06-10。
5. **供应商2 正常入库**：牛肉 10 @20（入库金额 200）；`updateNoteTime` 改为 2026-06-15。
6. **供应商2 正常入库（区间外）**：牛肉 10 @20；`updateNoteTime` 改为 2026-07-01，用于验证不进 6 月报表。
7. `createBill` 把供应商1 的三张单（正常入库、手动入库、退货）加入对账单；再 `removeNote` 去掉手动入库单。
8. `createBill` 把供应商2 的两张单（6/15、7/1）加入对账单。
9. `setBillStatus` `status=confirm` 确认两张对账单；供应商1 账单内订单变为 `statement`（手动入库单仍为 `instocked`）。
10. 下载 `stateNote`（begin=2026-06-01，end=2026-06-30）：
    - 「应付款汇总」：供应商1 应付 360（400−40）、供应商2 应付 200，汇总行应付 560；已付/未付/印花税税额/印花税缴纳月份为空。
    - 「供应商1」按日期：6/1 正常入库（400，评分 5，评价货好）、6/10 退货（−40）。无手动入库行。汇总：入库/结算 360。
    - 「供应商2」只有 6/15 那张（200）；7/1 不出现。汇总：入库/结算 200。
11. **取消确认**：供应商1 对账单 `setBillStatus` `status=normal`；再下载，汇总只剩供应商2（200），供应商1 不再出现。
12. `addNote2Bill` 把手动入库单加回供应商1 对账单，再次 `confirm`。
13. 再下载：供应商1 应付 460（400+100−40），汇总 660；「供应商1」三行按 createTime：6/1、6/5、6/10，汇总入库/结算 460。

# 注意点
- 订单从 `instocked` 变为 `statement` 只走对账单确认：`/app/bill/setBillStatus` `status=confirm`。不要用 `processNote action=statement` 等已废弃路径。
- 取消确认同一接口 `status=normal`，订单回到 `instocked`，不再进入报表。
- 退货单库里的 `instockCost`/`statementCost` 仍为正数，excel 金额乘 -1。
- 统计区间：`createTime >= begin` 且 `< end+1天`。7/1 入库压在上界上，不能进 6 月报表。
- 改订单日期用 `/app/note/updateNoteTime`（不要用 `/free/update`）。手动入库用 `salesDay` 写 `createTime`。
- 评分取 `note.rate`（`setRate` 回写到订单）；`rate` 为 0 或空时 excel 显示「没有评分」。评价取 `note.remark`。`setRate` 的 remark 在 rate 表，测试里额外用 `/free/update` 写到 `note.remark`。
- 下载校验用 `MultiSheetDownloadAction`，一次拿到全部 sheet：`{ 应付款汇总, 供应商1, 供应商2 }`。取消确认后不应再有「供应商1」sheet。
- 每个步骤如果需要调用多次接口，请把它集合成 TestCase；只有 1 个 Action 时不要包成 TestCase。
- 每个 TestCase 或者 Action 都要有备注说明该步骤执行的内容（detail 仅弹窗显示备注）。

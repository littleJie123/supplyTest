# 简介
验证下载订单一览时带出评分、评价：已评分显示分数和评价，未评分显示「没有评分」。覆盖 `/app/note/downloadNotes` 与对账单下载 `/app/bill/downBill`。

# 测试步骤
1. 引用 `PreTest`（餐厅、供应商1/2、物料）。
2. **已评分订单**：`createNote` 白菜 10 @20 → `sendNote`；`setRate` 评分 5、评价「货好」；再用 `/free/update` 把评价写入 `note.remark`。
3. **未评分订单**：`createNote` 鸡蛋 10 @20 → `sendNote`，不评分。
4. `listNoteGroup`（NoteDay）当日 `noteCnt=2` → `saveShareData`。
5. 下载 `/app/note/downloadNotes` 的「订单一览」：
   - 已评分单：评分 **5**，评价 **货好**。
   - 未评分单：评分 **没有评分**，评价为空。
6. `batchProcessNote` 入库 → `createBill` 把两张单加入对账单。
7. 下载 `/app/bill/downBill` 的「订单一览」，评分/评价期望与步骤 5 相同。

# 注意点
- 评分取 `note.rate`（`setRate` 回写到订单）；`rate` 为 0 或空时 excel 显示「没有评分」。评价取 `note.remark`。`setRate` 的 remark 在 rate 表，测试里额外用 `/free/update` 写到 `note.remark`。
- `downloadNotes` / `downBill` 参数挂 URL query（含 `warehouseGroupId`）。
- 嵌套 TestCase / 每个 Action 都有 remark。

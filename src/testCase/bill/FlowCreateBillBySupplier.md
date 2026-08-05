# 简介
验证 `/app/bill/createBillBySupplier`：只拉取该供应商下 `billId=0` 且 **status=instocked** 的订单创建对账单，并自动 `setStatus(confirm)`（订单随之变为 statement）。覆盖「未入库 / 其他供应商」不被卷入。

# 测试步骤
1. 引用 `PreTest`（仓库、供应商1/供应商2、物料白菜/猪肉/鸡蛋/羊肉等）
2. 供应商1下单并入库：白菜+猪肉，数量10、单价20 → 入库金额 **400**；记下该 `instocked` 订单
3. 供应商1再下一单并发送，**不入库**（status=normal）——对账时不应收录
4. 供应商2下单并入库：羊肉 —— 对供应商1对账时不应卷入
5. 调用 `/app/bill/createBillBySupplier`，`supplierId=供应商1`
6. 查 `/app/bill/listBill`：供应商1有 **1** 张账单，`status=confirm`，`noteCnt=1`，`instockCost=400`
7. 校验 note 条数：
   - 供应商1 `instocked` = 0（已变 statement）
   - 供应商1 `statement` = 1
   - 供应商2 `instocked` = 1（未被卷入）
   - 供应商1 `normal` = 1（未入库单仍在）

# 注意点
- 与旧版差异：`findNotes` 增加 `status=instocked` 条件；创建后对每张账单执行 `setStatus(confirm)`
- 未入库（normal）订单即使同供应商也不会进账单
- 每个 Action / 嵌套 TestCase 都有 remark

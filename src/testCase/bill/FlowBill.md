# 简介
对账单主流程：建单、移除/加回订单、改应付、确认对账、取消对账、改物料对账数量与单价、删单后重建。

# 测试步骤
1. 引用 `PreTest`；两张已入库订货单（白菜+猪肉；羊肉+猪肉+牛肉，各数量 10、单价 20），再对第二单物料退货数量 5
2. `schNote4Bill`：3 张单（2 订货 + 1 退货）
3. `createBill`：`noteCnt=3`，`itemCnt=8`，`instockCost`/`statementCost`=700（1000−5×20×3）
4. `removeNote` 去掉第一张订货单；`listNote` 账单内剩 2 张；修改历史 1 条
5. `updateBill`：`payCost=100`、`payFee=0.8`、`already=true`，`listBill` 校验
6. `setBillStatus` `status=confirm`；`listNote` 账单内订单全部为 `statement`
7. **取消对账**：`setBillStatus` `status=normal`；`listBill` 账单为 `normal`；`listNote` 账单内订单全部回到 `instocked`
8. 改订货单物料对账数 8、单价 15；`listBill` `statementCost=220`、`instockCost=250`
9. 改退货单物料对账数 4、单价 15；`listBill` `instockCost=275`、`statementCost=260`
10. `addNote2Bill` 把之前移出的订货单加回；`removeBill` 删账单
11. 再 `createBill`；对两张单 `SetNoteStatusInBill` 为 `statement`

# 注意点
- 取消对账走 `/app/bill/setBillStatus`，`status=normal`（与确认对账同一接口，状态相反）
- 取消后账单仍挂着原订单（`billId` 不变），只改 `bill.status` 和关联 `note.status`（`statement` → `instocked`）
- 后续改物料、加单、删单在「未对账」账单上继续，不重新 confirm

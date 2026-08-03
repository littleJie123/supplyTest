# 改价后刷新对账单

验证 `noteDomain.onUpdatePrice`：订单已加入对账单（`billId != 0`）时，改价/改量后会调用 `billDomain.refresh` 同步对账单金额。

**变更必须同时影响并校验：**
- `billDo.instockCost`
- `billDo.statementCost`

只测餐厅端，不测供应商链接单。

> 入对账单后 `statementCnt` 固定；改 `instockCnt` 时：`instockCost` 按新入库量，`statementCost` 按 `statementCnt × 新单价`，两者可以不同。

## 前置条件

1. 订单已入库（`instocked`）
2. 订单已通过 `/app/bill/createBill` 加入对账单（**未** confirm）

## 流程

1. PreTest + PreNote：猪肉、白菜各 10，单价 20 → 订单/对账单金额 400
2. **调大**：猪肉价 20→25、入库量 10→15  
   - `instockCost` = 15×25 + 200 = **575**  
   - `statementCost` = 10×25 + 200 = **450**（statementCnt 仍为 10）
3. **调小**：猪肉价 25→15、入库量 15→8  
   - `instockCost` = 8×15 + 200 = **320**  
   - `statementCost` = 10×15 + 200 = **350**
4. 每步均用 `listNote` / `listBill` / 库表 `bill` / `listNoteItem` 校验两个金额字段

## 相关代码

- `NoteDomain.onUpdatePrice` → `refreshBillByNotes` → `BillDomain.refresh`
- 接口：`/app/note/updatePrice`、`/app/bill/createBill`、`/app/bill/listBill`

## 自动化测试

用例类：`FlowBillOnUpdatePrice`（`supplyTest/src/testCase/note/FlowBillOnUpdatePrice.ts`）

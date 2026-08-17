# 简介
验证 `noteItemDomain.parseInstockCnt`：`updatePrice` 改量时不传 `buyUnitFee`，`instockCnt` 按 `noteItem.stockUnitsId`（箱）换算后以订单 `buyUnitFee`（瓶）落库。

# 测试步骤
1. 引用 PreTest
2. `/free/query` 查 `units`：`name in ['箱','瓶']`（不传仓库字段），记下箱/瓶 `unitsId`
3. `updateMaterial`：牛肉规格改为瓶 → 箱（`fee=5`，采购单位箱）
4. `createNote`：牛肉 `cnt=10`、`buyUnitFee=1`、`stockUnitsId=箱`
5. `sendNote` 发单
6. `BatchProcessNote` 整单入库
7. `listNoteItem` 记下 `noteItems`
8. `updatePrice`：牛肉 `instockCnt=5`（5 箱），**不传 buyUnitFee**
9. `/free/query` 查 `noteItem`：期望 `instockCnt=25`、`buyUnitFee=1`、`stockUnitsId=箱`
10. `recal` + `CheckStock`：牛肉库存 25 瓶

# 注意点
- 牛肉：1 箱 = 5 瓶；改量 5 箱 → 25 瓶
- 箱/瓶 id 经 `/free/query` 查 `units` 得到，禁止写死
- 最终数量以库表 `noteItem.instockCnt` / `buyUnitFee` 为准（不用 listNoteItem 的展平 `instock` 对象判等）
- 每个 Action 都有 remark

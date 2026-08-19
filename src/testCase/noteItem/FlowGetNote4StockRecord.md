# 简介
测试 `/app/noteItem/getNote4StockRecord`：根据库存流水上的 `noteItemType` + `noteItemId` 反查对应单据（订单 / 其他消耗），供客户端跳转详情页。

# 测试步骤
1. 引用 PreTest（初始化餐厅、供应商、物料）
2. 下单牛肉并记下 `noteId`、`noteItemId`（createNote → listNoteItem）
3. `getNote4StockRecord`：`noteItemType=noteItem`，期望 `type=Note`、`id=noteId`
4. 盘点牛肉 10 斤 100 元（给后续其他消耗扣库存）
5. 新增其他消耗并记下 `otherUseId`、`otherItemId`（listOtherType → saveOtherUse 报损牛肉 1 斤 → listOtherItem）
6. `getNote4StockRecord`：`noteItemType=other_item`，期望 `type=OhterUse`、`id=otherUseId`

# 注意点
- 接口入参：`noteItemType`、`noteItemId`、`warehouseGroupId`（Action 自动注入）
- `noteItemType` 取值：`noteItem`（订单物料）、`other_item`（其他消耗物料）
- 返回 `{ type, id }`：订单为 `Note`；其他消耗为 `OhterUse`（与服务端拼写一致）
- 下单 / 新增消耗若需多次接口，收成嵌套 TestCase；`getNote4StockRecord` 每步只有 1 个 Action

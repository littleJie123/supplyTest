# 简介
测试 `/app/stockRecord/listStockRecord4Inventory`：盘点历史只返回当前盘点之前的库存流水；其他消耗挂 `otherUse.otherType.name`；返回字段按客户端 `InventoryHistory` 裁剪。

# 测试步骤
1. 引用 `PreTest`（初始化餐厅、供应商、物料）
2. 5月1日盘点牛肉 10 斤、100 元（`setInventoryByArray`）
3. 新增 6 月 1 日报损：牛肉 1 斤（`listOtherType` → `saveOtherUse`）
4. 7月1日盘点牛肉 20 斤、200 元（当前正在查看的盘点）
5. Recal（写入流水 afterStocks/changeCnt；盘点历史的数量/金额由 `formatList` 从这两列汇总）
6. `/free/query` 查出 7/1 牛肉盘点的 `inventoryId`
7. `listStockRecord4Inventory`：期望 2 条（5/1 盘点 + 6/1 报损），不含 7/1 本盘；报损行 `otherUse.otherType.name=报损`；无 `afterStocks`/`warehouseId` 等冗余字段
8. 再带 `cdts.bussinessDate=2026-05-01` 查询，期望只剩 5/1 盘点 1 条

# 注意点
- 历史截止：`inventoryId` 对应流水的 `bussinessDate`，只查 **小于** 该时间的记录，所以当前这次盘点自己不会出现
- 盘点 `calType=set`，接口用 `afterStocks` 汇总成 `cnt`/`cost`；消耗用 `changeCnt`。不 Recal 这两列为空，数量会显示成 0
- 消耗类型走 `OtherTypeHat`，挂在 `otherUse.otherType.name`（不是把 `type` 改成中文）
- 返回字段对齐 `InventoryHistory`：日期/数量/金额/类型/操作日期/操作人、`StockInp` 用的 `buyUnit`/`unitsId`/`stockUnitsId`/`name`，以及档口 `inventoryStalls`
- 查类型 + 保存消耗收成嵌套 TestCase；列表查询每步只有 1 个 Action

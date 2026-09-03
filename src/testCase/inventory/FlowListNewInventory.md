# 简介
校验盘点日期列表 `listInventoryDay` 与盘点物料列表 `listNewInventory`。先 6/1 入库羊/猪，再在 **7/1** 和 **当天** 加入羊肉+牛肉盘点（只填牛肉数量，羊肉保持未盘完）。界面 init 数量为空；历史下载 `isAll=2` 才带 init 的库存。

# 测试步骤
1. **前置**：`PreTest`，羊肉/牛肉/猪肉初始单位「包」。
2. **6月1日入库**：`createHandInstock`，羊肉 **2包**、猪肉 **2包**（`cnt=2, buyUnitFee=1`），`salesDay=2026-06-01`。
3. **7月1日盘点**（嵌套 `PrepCreateInventory`）：
   1. `addInventory` 加入羊肉、牛肉（`createInventory` 按 type 拉历史物料，无法只选这两样；接口只能写当天）。
   2. `setInventoryToInfo` 牛肉 **1包**。
   3. `setInventoryFromInfo` 保存牛肉为 `finished`。
   4. `/free/update` 羊肉 `status=init`。
   5. `changeInventoryTime`：当天 → `2026-07-01`。
4. **当天盘点**（`DateUtil.todayStr()`，同样嵌套）：`addInventory` 羊肉+牛肉，牛肉 **0.5包**，羊肉改为 `init`（不再改日期）。
5. **Recal**：`/free/stateMaterial/recalStateMaterial`。
6. **校验 7/1**：
   1. `listInventoryDay`：选择=2、实际=1。
   2. 界面 `listNewInventory`：牛肉 `finished` 且 `inventory.cnt=1`；羊肉 `init` 且 `inventory` 为空；无猪肉。
   3. 下载 `isAll=2`：牛肉填盘点数量 1 包；羊肉未盘，填 6/1 入库后的库存 **2 包**。
7. **校验当天**：
   1. `listInventoryDay`：选择=2、实际=1。
   2. 界面：牛肉 `0.5` 包已盘、羊肉未盘；无猪肉。
   3. 下载 `isAll=2`：牛肉填盘点数量 0.5 包；羊肉未盘，数量列为空。
   4. 下载物料总数 `isAll=1`：3 条；牛肉填盘点数量；羊肉/猪肉未盘，数量应空（不能是 0 包）。

# 注意点
- `createInventory` 只按 type 复制某日物料且 `inventoryDay` 固定当天，指定羊+牛用 `addInventory`；7/1 先在当天建再 `changeInventoryTime`。
- `addInventory` 不写 `status`，羊肉需 `/free/update` 成 `init`，否则日期列表不算进选择物料。
- 6/1 是入库不是盘点；猪肉只入库，不进 7/1/当天盘点列表。
- Recal 是单接口 Action；7/1 与当天准备各含多次接口，收成嵌套 TestCase。
- 每个 TestCase / Action 都有 `remark`。
- 按包盘点 `buyUnitFee=1`。当天日期用 `DateUtil.todayStr()`，不要写死。
- Excel 数量列：已盘一律填盘点数量；当天未盘留空（含「物料总数」里拼进来、没有 `status=finished` 的行，避免 `createNameWithStock` 把空库存显示成 0 包）；历史未盘填该日之前的库存（`LastStockRecordHat`）。

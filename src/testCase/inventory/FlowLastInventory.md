# 简介
校验物料大厅 `listMaterialByCategory`、快捷订货 `listMaterial4FastNote` 的「上次盘点」改从 `stockRecord`（`FindLastInventoryHat` / `findLastStock`）读取后，连续两次盘点应返回**最近一次**，而不是上上次。

# 测试步骤
1. **前置**：`PreTest`（仓库/供应商/基础物料）。
2. **第一次盘点**：`setInventoryByArray`，日期 `2026-05-01`，羊肉 `cnt=30`；`Recal`。
3. **校验**：`listMaterialByCategory`、`listMaterial4FastNote` 羊肉的 `lastInventory.cnt=30`，且有 `userOfModify`、`sysModifyTime`。
4. **第二次盘点**：`setInventoryByArray`，日期 `2026-07-01`，羊肉 `cnt=80`；`Recal`。
5. **再校验**：两个列表接口羊肉的 `lastInventory.cnt` 均为 **80**（不得仍为 30）。

# 注意点
- 回归点：旧逻辑把摘要写在 `stallMaterialInfo`（按 inventoryId），多次盘点会留下多条，大厅会读到「上上次」；现改为按 `stockRecord.type=Inventory` 取最近一条。
- 每个 Action 均有 `remark`；本用例步骤均为单接口或 Recal，未再包嵌套 TestCase。
- 返回结构仍为 `lastInventory: { cnt, buyUnitFee, cost, userOfModify, sysModifyTime, ... }`，与原先 StallMaterialInfoHat 一致。

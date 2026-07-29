# PreTestWithMeat

在 `PreTest` 基础上准备羊/牛/猪肉及规格，供其他消耗等用例复用。

## 目的

统一初始化「带包规格的肉类」物料，避免各 Flow 重复写创建单位与 `saveBuyUnit`。

## 测试步骤

1. **PreTest**：创建仓库、供应商、分类；物料：
   - 羊肉：初始单位 **克**
   - 牛肉：初始单位 **包**
   - 猪肉：初始单位 **克**（不再转化规格）
2. **转化规格**（`/app/material/saveBuyUnit`）：仅羊肉、牛肉转为 `克(fee:1)` + `包(fee:100)`，采购单位为包。
3. **刷新物料**：`listMaterial` 更新 `materialMap`。

## 规格注意

- 创建时初始单位必须是后续规格链上的单位，不能先建「斤」再改。
- `saveBuyUnit` **不改**已有 `unitsId`：
  - 羊肉标准单位=克 → 按包盘点用 `buyUnitFee: -100`
  - 牛肉标准单位=包 → 按包盘点用 `buyUnitFee: 1`
  - 猪肉仍为单单位克 → 按克用 `buyUnitFee: 1`

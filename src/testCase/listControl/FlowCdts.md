# 简介
校验 fastsaas `ListControl` 通用查询条件 `cdts`。通过 `/app/material/listMaterialByCategory` 覆盖等值、`like`、`in`、顶层 `or`/`and`、嵌套条件，以及物料列表「名字或拼音首字母」业务场景。

# 测试步骤
1. **前置**：`PreTest`（物料含猪肉、羊肉、牛肉、鸡蛋、白菜；创建时写入 `firstPinyin`：zr/yr/nr/jd/bc）。
2. **等值 `=`**：`cdts.array=[{col:'name', value:'羊肉'}]` → 只返回羊肉。
3. **`like` 无 `%`**：`name like '肉'` → 自动变成 `%肉%`，含猪/羊/牛，不含鸡蛋、白菜。
4. **`like` 已有 `%`**：`name like '%肉%'` → 原样使用，结果同上。
5. **`like` 仅一侧 `%`**：`name like '肉%'` → 不自动再包，以「肉」开头才命中（猪羊牛均不命中）。
6. **业务：按名字**：`name like '羊' or firstPinyin like '羊'` → 只返回羊肉（对齐 MaterialList `schCol`）。
7. **业务：按首字母**：`name like 'yr' or firstPinyin like 'yr'` → 只返回羊肉（`firstPinyin=yr`）。
8. **业务：单字母首字母**：`name/firstPinyin like 'j'` → 含鸡蛋（`jd`），不含猪羊牛白菜。
9. **业务：首字母 bc**：`name/firstPinyin like 'bc'` → 只返回白菜。
10. **`in`（数组默认）**：`materialId` 为 `[羊肉Id, 牛肉Id]` → 只返回羊、牛。
11. **顶层 `or`**：`name=羊肉 or name=白菜` → 羊、白菜。
12. **顶层 `and`**：`name like '肉' and materialId=羊肉` → 只返回羊肉。
13. **嵌套**：`like '肉' and (name=羊肉 or name=白菜)` → 只命中羊肉（白菜不含「肉」）。

# 注意点
- `op=like` 时：value 字符串不含 `%` 则左右补 `%`；已含任意 `%` 则不改。
- 数组 `value` 且未写 `op` 时，Cdt 默认按 `in`。
- 顶层 `cdts.op` 默认 `or`；嵌套项 `op` 为 `or`/`and` 时用内部 `array`。
- 物料大厅搜索（MaterialList）为 `name` 与 `firstPinyin` 的 OR like，本用例用同一关键字构造 `cdts` 模拟。
- 结构约定见 `doc/ListControl查询条件.md`。

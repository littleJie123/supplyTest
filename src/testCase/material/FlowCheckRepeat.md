# 简介
校验 `/app/material/checkRepeat`。同名物料按 `name` 分组，`cnt>1` 才会返回。传入 `lastTime` 时 having 使用 `NoteSafeCdt('max(sysAddTime)')`，接口不能报 `Cdt字段不合法`。

# 测试步骤
1. **前置**：登录并创建仓库。物料不走保存接口，用 `/free/add` 插入两条同名「重复土豆」（`RPT001`、`RPT002`）和一条「唯一白菜」（`RPT003`）。
2. **不传 lastTime**：`checkRepeat` 返回「重复土豆」，`cnt>1`，没有「唯一白菜」。
3. **lastTime=1**：同样能返回「重复土豆」。这一步会执行 `max(sysAddTime)` 条件。

# 注意点
- 两条同名物料是刚刚创建的，`sysAddTime` 在最近 5 分钟内，所以 `lastTime` 不会把它们滤掉。
- 若 `max(sysAddTime)` 仍用普通 `Cdt`，第 3 步会 HTTP 500，`error.message=Cdt字段不合法`。

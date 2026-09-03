# 简介
测试“最大编码提示”接口：校验按分类和按全量两种统计口径，是否能返回当前最大编号，且返回结构符合前端显示需求。

# 测试步骤
1. 引用 `PreTest`：创建餐厅、供应商、分类，并新增三条物料：猪肉 `A001`、羊肉 `A003`、白菜 `B002`。
2. 调用 `/app/material/findMaxCode`，传 `categoryId=${categoryMap.肉类}`，校验返回 `code=3`。
3. 调用 `/app/material/findMaxCode`，不传 `categoryId`，校验返回 `code=3` 且 `name` 为空。

# 注意点
- 接口返回是 `{ code, name }`，其中 `name` 仅在选分类时返回分类名称。
- 比较编码时按最后一段数字解析，忽略前缀字母和非数字部分。
- 此用例只验证最大编号查询，不覆盖前端 placeholder 展示。

# 运营平台工作台

测试 `/admin/dashboard/refreshDashboard` 和 `/admin/dashboard/listDashboard`。

统计的是全库，用例用刷新前后的差额判断，不用绝对数量。造数用 `/free/add`，结束用 `/free/del` 删掉，再刷新一次，避免把测试数留在当天快照里。

名称后缀用本次 openid，避免和旧数据撞名。

## 列表

1. 登录运营平台后刷新，再查当天。
2. 固定 6 条，顺序为 warehouse、note、users、inventory、purcharse、send。
3. 没有 `json`，有 `jsonData.array`。
4. warehouse、note、users、purcharse、send 的 `remark` 带同一次统计时刻 `yyyy-MM-dd HH:mm:ss`。盘点 `remark` 为「上月1日 至 该时刻 的盘点明细行数前10」。
5. 柱状图最多 10 条，数量从高到低。

## 差额

计入：

- 餐厅 `dash餐厅{openid}`、餐厅 `atest{openid}`（不是 `_test` 开头）、供应商 `dash供应商{openid}`
- 用户 openid `dash{openid}`
- 餐厅上的订货单 `normal`、供应商上的发货单 `normal`、餐厅上的退货单 `back`（只进订单总数，不进订货单图）
- 餐厅上 `status=finished` 的盘点，日期为今天或上月 1 日

不计入：

- 仓库名以 `_test` 开头、`isDel=1` 的仓库
- openid 以 `_test` 开头、`isDel=1` 的用户
- 订单 `status=init`、`isDel=1`
- 盘点 `status=default`、`isDel=1`、日期早于上月 1 日

订货单、发货单、盘点要进入前 10 时，条数取当前第 10 名 + 1。第 10 名已经不小于 5 时只插 1 条，不断言一定出现在图里，只断言订单总数和排序。

## 重复刷新

再刷新一次。6 条还在，卡片数量不变。当天 `isDel=1` 的统计比第一次刷新后多 12 条（后两次刷新各软删上一轮 6 条）。同一秒内 `remark` 时刻可以相同。

删掉造数后再刷新，卡片数量回到第一次的基线，图里不再出现本次造的仓库名。

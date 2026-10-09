# 工作台

测试运营端系统工作台，以及客户端用户工作台的查询和保存。

## 前置

注册测试用户并创建门店。登录运营平台前，调用 `/free/del` 删除所有 `name` 以 `_test_` 开头的系统工作台。用例结束再删一次。

名称：`_test_订单`、`_test_库存`、`_test_盘点`、`_test_供应商`。新增不传 `sort`、`groupSort`，必须传 `type`。测试门店类型是 `store`。

## 系统工作台

1. 不传 `type` 新增应失败。门店工作台使用供应商权限应失败。门店工作台使用 `type=all` 的权限可以通过，用完后删除。新增订单，分组「订货」，`type=store`，`routersKey` 为同类型测试权限。没有同组，`sort=0`，`groupSort` 为当前最大 `groupSort+1`（表里还没有则为 0）。同名可以再新增，查到两条后再删掉第二条。
2. 再新增库存，同一分组，`type=store`。`groupSort` 沿用订货分组，`sort` 为同组最大 `sort+1`（即 1）。
3. 新增盘点，分组「盘点」，`type=all`。没有同组，`sort=0`，`groupSort` 再加 1。库存可以改成订单名称，再改回库存。
4. 先把订单 `groupSort` 改成 4、库存改成 8，再 `setSort`。组内顺序为库存、订单；全组 `groupSort` 变成 4（`workbenchId` 最小且 `groupSort` 不为空的那条）。
5. `setGroupSort`：分组顺序为盘点、订货。列表中这三条的顺序为盘点、库存、订单。
6. 更新盘点时仍在「盘点」分组，传入的 `sort`、`groupSort` 不生效，沿用同组 `groupSort=0`，`sort` 不变，图片会更新。把库存改到新分组，`groupSort` 为当时最大 `groupSort+1`，`sort` 仍为 0；再改回「订货」，`groupSort` 回到 1。
7. 删除订单后查不到。再用同名新增，分组「订货」的 `groupSort` 为 1，`sort` 为同组最大 `sort+1`（库存为 0，所以是 1）。再新增供应商工作台，`type=supplier`。
8. 按 `type` 查询：`store` 只有库存和订单，`all` 只有盘点，`supplier` 只有供应商。不传 `type` 时四条都在，顺序为盘点、库存、订单、供应商。

## 用户工作台

1. `/app/workbench/getWorkbench`：按门店类型查询系统工作台，`type in (store, all)`。盘点在订货前面，订货组内库存在订单前面。供应商工作台不返回。
2. `/app/workbenchUser/getWorkbenchUser`：没有个人配置时，同样按门店类型过滤后，按系统 `groupSort`、`sort` 分组返回。已删除的、供应商类型的不返回。`workbench` 只含 `workbenchId`、`name`、`imageKey`、`url`、`routersKey`。
3. `/app/workbenchUser/saveWorkbenchUser`：分组下标写入 `groupSort`，组内下标写入 `sort`。按 `groupName` + `workbenchId` 唯一，同一个工作台可以出现在多个分组；同组重复只保留后一次的位置。已删除的系统工作台不出现。从某个分组拿掉后，其它分组里的同一工作台还在；再放回去时恢复原来的记录。

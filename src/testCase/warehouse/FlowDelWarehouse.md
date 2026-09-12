# 简介
测试 `/app/warehouse/delWarehouse`：管理员删除仓库本身，非管理员只删除自己与仓库的关联。

# 测试步骤
1. 数据初始化：`FindLastUserId` → `GetOpenId` → `AddWarehouse` → `ChangeWarehouse`，得到管理员和第一家门店。
2. 校验创建人 `usersWarehouse`：`warehouseId=0`、`isAdmin=1`。
3. 保存管理员 token。
4. 再注册一个用户（`/free/getUserToken`，不沿用当前 token）。
5. `/free/add` 给该用户插入 `usersWarehouse`：`isAdmin=0`，绑定当前仓库。
6. 切到非管理员，调用 `delWarehouse`：仓库仍在（`isDel=0`），该用户的 `usersWarehouse` 为 `isDel=1`。
7. 切回管理员，再调用 `delWarehouse`：仓库为 `isDel=1`。

# 注意点
- 必须先测非管理员再测管理员：管理员删完后 `getById` 查不到仓库，非管理员删除会变成空操作。
- 第二个用户必须走 `getUserToken`，不能走 `getOpenId`：请求头里如果还带着管理员 token，会当成同一人登录。

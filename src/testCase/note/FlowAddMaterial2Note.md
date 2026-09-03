# 简介
测试订单中新增物料的功能。

# 测试步骤
1. 执行 `PreTest` 初始化测试仓库、供应商和物料。
2. 创建第一张不含猪肉的正常订单，查询当天正常订单分组并批量处理为已入库。
3. 调用 `/app/note/addMaterial2Note`，向第一张已入库订单新增猪肉，期望接口返回 HTTP 500，错误 message 为“订单状态不支持新增物料”。
4. 创建第二张包含猪肉但未入库的正常订单。
5. 调用 `/app/note/addMaterial2Note`，向第二张订单再次新增猪肉，期望接口返回 HTTP 500，错误 message 为“物料已存在”。
6. 创建第三张不含猪肉且未入库的正常订单。
7. 调用 `/app/note/addMaterial2Note`，向第三张订单新增猪肉，期望接口返回 HTTP 200，并直接检查返回的新增明细：物料为猪肉，`purcharse.cnt=400`、`purcharse.buyUnitFee=1`、`supplierMaterial.buyUnitFee=-10`、`supplierMaterial.price=21`；同时供应商1订单 `cost=846`、`materialCnt=2`，订单明细共 2 条。

# 注意点
- 三个场景共用一次 `PreTest`，通过三张订单分别隔离订单状态和物料是否存在。
- 已入库订单场景先验证订单状态；新增物料是否已存在不影响该状态校验。

# 测试场景
- 已经被入库的订单：插入失败
- 被插入订单存在的物料。插入失败
- 正常订单，插入成功。验证新的订单的cost，materialCnt以及拉取noteItem验证物料是否被插入。
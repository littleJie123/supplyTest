# 简介
把源仓库的物料、供应商、档口、餐品、BOM、销售记录、订单、盘点、其他消耗复制到另一个品牌的目标仓库，再用 list 接口校验。

# 测试步骤
1. 引用 `PreTest`：创建源仓库、分类（肉类/蛋类/蔬菜）、物料（猪肉/羊肉/牛肉/鸡蛋/白菜）、供应商1/2。
2. 准备源仓业务数据：
   1. 增加餐品「红烧牛肉」，BOM 每份牛肉 1（`buyUnitFee=1`，price=10）。
   2. 新增档口A。
   3. 下单牛肉 2 并入库：`createNote` → `sendNote` → `processNote`。
   4. 盘点牛肉 10（`setInventoryByArray`，日期 2026-08-01）。
   5. 增加销售记录：红烧牛肉 1 份，日期 2026-08-02。
   6. `listOtherType` 取报损，`saveOtherUse` 报损牛肉 1（日期 2026-08-03）。
3. 注册目标仓库「复制目标仓」（`AddWarehouse`，`variableType=warehouse2`），得到**新的** `warehouseGroupId`。
4. 保存用户 token；生成本次复制的 `copyNo`。
5. 管理员登录。
6. 请求 `/admin/copyDatas/getCopyTables`，校验返回表列表为：category、material、supplier、supplierMaterial、stall、stallMaterialInfo、otherType、otherUse、otherItem、product、bom、salesRecord、note、noteItem、inventory、stock、stockRecord。
7. 按表循环调用 `/admin/copyDatas/submitCopyDatas`（源=`warehouse`，目标=`warehouse2`）；每张表直到 `isFinish=true`。外键在 copy_datas 查不到时 status=fail。
8. 恢复用户 token，切换到目标仓，用 list 接口校验：
   - `listsupplier`：有供应商1、供应商2
   - `listSupplierMaterial4Supplier`：供应商2 有物料报价
   - `listStall`：有档口A
   - `listMaterialByCategory`：有猪肉/羊肉/牛肉/鸡蛋/白菜
   - `listProduct`：有红烧牛肉
   - `listBom`：红烧牛肉 BOM 为牛肉 cnt=1
   - `listSalesRecord`：红烧牛肉销售 1 份
   - `listNote`：至少 1 张订单
   - `listNoteItem`：牛肉采购数量 2
   - `listInventory`：牛肉盘点数量 10
   - `listOtherType`：有报损
   - `listOtherUse`：至少 1 条
   - `listOtherItem`：牛肉消耗数量 1
   - `listStockRecord4Inventory`：`noteItemId` 按 `noteItemType` 分别等于目标仓 inventory / noteItem / otherItem / product 主键

# 注意点
- 目标必须是**新品牌**（新 `warehouseGroupId`）。同一品牌下复制会把 category/material 再插一遍，名称可能冲突。
- 生产环境不能作为目标；`submitCopyDatas` 的 `target.env` 用当前测试环境（local / test）。
- 复制：`getCopyTables`、`submitCopyDatas` 都走运营平台；源环境只能是当前环境。校验前要切回用户 token 并 `changeWarehouse` 到目标仓，list 入参显式带 `warehouse2` 的 id。
- `stockRecord.noteItemId` 不能按字段名推断表：`inventory`→盘点、`noteItem`→订单明细、`other_item`→其他消耗明细、`product`→餐品。
- 每个 TestCase / Action 都有 `remark`。源仓造数、同步所有表、list 校验都是嵌套 TestCase；只有 1 个 Action 的步骤不包 TestCase。

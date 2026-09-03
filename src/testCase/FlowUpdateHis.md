# 简介
测试修改历史（`updateHis`）：供应商/仓库改名、供应关系增删改、订单发单/入库/改价/改价改量/结算，以及关联后供应商接单、发货。订单历史走 `listNoteUpdateHis`；供应关系/供应商/仓库仍走 `listUpdateHis`。

# 测试步骤
1. 引用 `PreTest`：创建餐厅、供应商1/2、物料。
2. **订单状态历史**（`listNoteUpdateHis`，`noteId`）
   1. `createNote`：餐厅向供应商1下单猪肉，数量 10、单价 2。
   2. `sendNote`：`action=normal`，`remark=发单`，`detail` 为订单 title，无 oldData/newData；`parentTable=note`。
   3. `batchProcessNote instock`：只记整单 `note`（`action=instocked`，`detail`=title），**不写** noteItem。
   4. `updatePrice`：猪肉单价 2→5；只记 `noteItem` 的 `oldData`/`newData`（数量 `instockCnt=10`，价格 2→5，含 `stockBuyUnitFee`/`buyUnitFee`/`materialId`），不写整单 note；Hat 的 `detail` 只含变化项（有「原来」「新」「价格」，无「数量」）。
   5. `updatePrice`：同时改单价 5→4、入库数量 10→12；`oldData`/`newData` 都记 `instockCnt` 和 `price`；`detail` 含「原来」「新」「价格」「数量」。
   6. `batchProcessNote statement`：只记整单 `note`（`action=statement`），**不写** noteItem。
3. **供应关系历史**（`listUpdateHis`，`tableName=supplierMaterial`）：猪肉新增供应商2报价（单价 15）→ `updatePrice` 改为 25 → 删除。
   - add：只记 `newData`（`materialId`/`supplierId`/`price`/`buyUnitFee`），`parentTable=material`。
   - update：只记变化字段到 `newData`（price 变则 buyUnitFee 成对），无 oldData。
   - del：只记 `oldData`。
4. **供应商/仓库**：供应商1 改名为供应商A（`newData.name`、`warehouseGroupId` 非空）；餐厅连续改名为新餐厅2、新餐厅3。
5. 引用 `PreCreateNoteAndLink`（供应商名为供应商A）：首单分享接单。查 `Supplier_Link` 关联历史。
6. **接单/发货历史**（第二单自动链接，不需再分享）
   1. 切回餐厅，再下一单猪肉并 `sendNote`。
   2. 切到供应商仓，对 `status=normal` 的链接单 `batchProcessNote accept`：`listNoteUpdateHis`，`action=accept`，`remark=接单`，`detail=title`。
   3. `batchProcessNote send`：只记整单 `note`（`action=sended`），**不写** noteItem。

# 注意点
- 每个步骤如果需要调用多次接口，请把它集合成 TestCase；只有 1 个 Action 时不要包成 TestCase。
- 每个 TestCase 或者 action 都要有备注说明该步骤执行的内容（detail 仅弹窗显示备注）。
- 列表接口 `deFormat` 后业务内容在 `row.data`（`remark`/`detail`/`oldData`/`newData`）。noteItem/supplierMaterial 的物料名 remark（如 `修改数量价格:猪肉`）由 UpdateHisHat 在查询时补上，写入时不带名称。
- 订单相关查询改用 `/app/updateHis/listNoteUpdateHis`（`noteId` → `parentId` 且 `parentTable=note`），一次查出 note 与 noteItem。
- send / instock / statement 只记 note（`detail`=title，无 oldData/newData）；updatePrice 只记 noteItem（oldData+newData）。两者只记一个。
- `supplierMaterial` 的 parent 是 `materialId`/`material`；add 用 newData，update 只记变化字段。
- 链接单：只有第一单走分享/接单；再次发单会自动生成链接单，供应商侧为 `normal`，需要手动接单。

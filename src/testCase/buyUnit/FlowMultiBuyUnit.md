# 简介
多采购单位改造端到端用例。测试步骤与 `doc/多采购单位改造.md` 开发步骤 **一一对应**：每完成一个开发步骤，在本用例中追加同序号测试步骤（ts / md 同步维护）。

# 测试步骤
> 未实现的步骤勿写入 `buildActions`；开发到哪一步，用例就跑到哪一步。

1. **（开发步骤1）同供应商多规格持久化与 isDef** ✅  
   - 前置：`PreTest`  
   - 新增物料「多采购单位测试」：规格 `克` + `包(fee:100, isSupplier)`  
   - 同供应商两行：`克@10`（isDef）、`包@800`  
   - `getMaterialInfo`：两行均在，单位/价格/`stockUnitsId` 不同，克为默认  
   - `updateMaterial`：切换 isDef 为包@800  
   - 再查 getMaterialInfo：两行仍在，包为默认  
   - `listMaterialByCategory`：默认 SM 价为 800（仅返回 isDef=1 一行）  
   - **`/free/query` 查 `supplierMaterial`**：确认库表仍有 2 行（克@10 isDef=0、包@800 isDef=1，stockUnitsId 不同）  

2. **（开发步骤2）MaterialAndUnitsHat / BuyUnit4Material 保留主表 stockUnitsId** ✅  
   - 下单「多采购单位测试」明细 `stockUnitsId=克`（非物料默认包）  
   - `listNoteItem`：仍为克，`isSupplier` 落在克  
   - `free/query noteItem`：库表 `stockUnitsId` 为克  
   - 再下一单 `stockUnitsId=0`：`listNoteItem` 回退为物料采购单位包，`isSupplier` 落在包  

3. **（开发步骤3）SupplierMaterialHat 用默认 SM 单位覆盖** ✅  
   - `updateMaterial`：isDef 切回克@10（与物料默认采购单位「包」不同）  
   - `listMaterialByCategory`：行上 `stockUnitsId`、`isSupplier`、默认 SM 均为克，价 10  
   - `free/query`：确认 `isDef=1` 为克@10  

4. **（开发步骤4）规格自动补公制最小单位** ✅  
   - 批量新增并 `listMaterialByCategory`（`materialId:[...]` 只查这些物料）：  
     - **仅包** → `包(1)`（自定义，不补）  
     - **1包=3斤** → `克(1)+斤(500)+包(3)`（斤非 isMin，按 fees 补克）  
     - **1斤=3包** → `包(1)+斤(3)`（首项自定义，不补）  
     - **1包=100g** → `克(1)+包(100)`（g 别名转正式克，不再补）  
     - **1包=100克** → `克(1)+包(100)`（不变）  
     - **仅千克** → `克(1)+千克(1000)`  
   - `free/query buyUnit`（仅千克）：`fees=1,1000`  
   - 正式最小单位别名也标 `isMin=1`；补链只写正式单位  

5. **（开发步骤5）客户端契约：供应商+单位提交** ✅  
   - `updateMaterial`：与 UI（PriceByUnits）相同请求体，显式带 `stockUnitsId`+`unitsName`，克@12(isDef)、包@850  
   - `getMaterialInfo`：两行单位/价格与提交一致  
   - `free/query`：仍为 2 行（同供应商不同单位更新而非重复插入）  

6. **（开发步骤6）物料导入：单位别名转换 + 自动补最小单位** ✅  
   - 上传 `excel/buyUnit/补单位导入.xlsx`（表头同 `FlowUpload` 的 `物料.xlsx`：物料名称/物料单位/分类/物料规格/价格/供应商/物料编码/档口）  
   - 规格期望与步骤4一致：仅包 / 1包=3斤 / 1斤=3包 / 1包=100g→克 / 1包=100克 / 仅千克→补克  
   - `listMaterialByCategory` 校验；再按 `materialId` 复核  

7. **（开发步骤7）下单写入并查询 noteItem.stockUnitsId** ✅  
   - `updateMaterial`：isDef 切为包@850  
   - `listMaterialByCategory`：行上 `stockUnitsId`/价为包（客户端下单读默认 SM）  
   - `createNote`：提交该 `stockUnitsId`（不再硬编码 0）→ `listNoteItem`；**`free/query noteItem` 确认库表已写入 `stockUnitsId`（包）**  
   - isDef 切回克@12，再按下单路径写克单位订单 → **`free/query noteItem` 确认库表已写入 `stockUnitsId`（克）**  
   - `listNoteItemHis`（当天）：仍按 `materialId+supplierId` 合并为 1 行，`stockUnitsId` 取组内任意一个即可  

8. **（开发步骤8）链接单拷贝餐厅侧 stockUnitsId** ✅  
   - 注册供应商仓 → 克单位 `createNote` → 分享/`linkNote` 首次接单  
   - 餐厅 `listNoteItem`：克 + 有 `linkNoteItemId`；`listNote` 有 `linkNoteId`  
   - 链接 `listNoteItem` / `free/query`：`stockUnitsId` 与餐厅侧一致（克，非 materialLink.linkStocksUnitId）  
   - `updateMaterial` 改价触发 sync 后，链接 `supplierMaterial.stockUnitsId` 为克（非强制 0）  
   - 接单 `onLink`：同物料多规格时优先按订单明细 `stockUnitsId` 关联餐厅 SM，其次 `isDef`  

9. **（开发步骤9）全流程回归与边角** ✅  
   - `getMaterialInfo`：同供应商克/包两行仍在  
   - `listMaterialByCategory` → `createNote` → `free/query noteItem`：默认单位落库  
   - `free/query supplierMaterial`：两规格 `stockUnitsId` 均非 0  
   - 边角：已改 SM 导入 / 订单导入合并键 / 导入查价取 isDef；其余见注意点「本期不做」  

# 注意点
- 查价/下单只认 `isDef=1`；换单位下单 = 改物料里对应 SM 的 isDef，用例里用切换 isDef 验证，不要在下单接口里临时选单位。
- 每个嵌套 TestCase / Action 都要有 `remark`；多接口收成嵌套 TestCase，单 Action 不包一层。
- 步骤与开发步骤同号；开发步骤的**最后一项**必须是：在本 Flow 增加对应测试步骤并更新本 md。
- 客户端重复校验键为 `supplierId+stockUnitsId`（新建无 unitsId 时用 unitsName）；提示「供应商+采购单位不能重复」。
- 步骤6 导入规格期望与步骤4 Save 路径一致；Excel 构建参考 `FlowUpload` 上传物料。
- 步骤7：CreateNoteItem / NoteMaterial4Again / NoteMaterialHisDialog 提交 `row.stockUnitsId`（历史单优先 `supplierMaterial.stockUnitsId`）；ShareNote / ListNoteItemHis 等用 `MaterialAndUnitsHat`；`listNoteItemHis` 合并仍按 materialId+supplierId，单位取组内任意一个。
- 步骤8：链接明细拷贝餐厅 `noteItem.stockUnitsId`；`SupplierMaterialDomain.sync` 写餐厅 SM 单位（无效则用 `linkStocksUnitId`），不再清零；`onLink` 按明细单位/isDef 选 SM。
- 步骤9 已改：`SupplierMaterialDomain.onImport` 的 distinct/mapFun 含 `stockUnitsId`；订单 Excel `doImport` 合并键含 `stockUnitsId`；导入 `findPrice` 同物料取 isDef。
- **本期不做（步骤9注意点）**：
  - `onSaveAnswerPrice`：报价项未带 `stockUnitsId`，mapFun 暂仍 `materialId+supplierId`（待询价/报价带单位再改）
  - `setMaterial` / `onCombineMaterial` / `onChangeMaterial` 未专项改造
  - 盘点导入 `InventoryDomain.onImport` 仍写 `stockUnitsId:0`
  - 客户端 `StockServer.setPrice` / `changeSupplierVo` 可能把 SM 单位回退为 material 采购单位
  - 存量 `supplierMaterial.stockUnitsId=0` 全库回填脚本未做（用例物料路径已保证非 0）

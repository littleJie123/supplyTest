# 简介
将 `/free/downloadAll` 导出的 excel（物料、bom、订单、销售记录、盘点）重新导入到一个新建仓库，验证导出文件可以再导回去。

# 测试步骤
1. 查找最大测试用户、注册用户，新建餐厅仓库并切换
2. 上传 `excel/upload/物料.xlsx`（target=`material`）
3. 上传 `excel/upload/bom.xlsx`（target=`bom`）
4. 上传 `excel/upload/订单.xlsx`（target=`purcharse`）
5. 上传 `excel/upload/销售记录.xlsx`（target=`salesRecord`）
6. 上传 `excel/upload/盘点数据.xlsx`（target=`inventory`）

# 注意点
- 测试数据放在 `excel/upload/`，文件名与导出 zip 内一致：`物料.xlsx`、`bom.xlsx`、`订单.xlsx`、`销售记录.xlsx`、`盘点数据.xlsx`
- 导入顺序与 `FlowYunxia` 相同：物料 → bom → 订单 → 销售 → 盘点（物料/供应商先有，后面的 bom/订单/销售/盘点才能匹配）
- 不预创建供应商：物料表里的「供应商」列会在导入时创建
- 每个文件：列能全部自动匹配则上传时直接导入；否则再调 `saveExcel`
- 上传 + saveExcel 收成嵌套 `UploadExportFile`（多个接口）；前置登录/建仓各是单个 Action

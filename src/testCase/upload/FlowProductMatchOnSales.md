# 餐品匹配（销售导入）

对应需求：`supplychain/doc/餐品匹配_需求.md`

销售记录导入时，餐品匹配顺序：

1. 按 code 匹配  
2. 按 name + scaleName 严格匹配  
3. **宽松**：上传侧同名仅一种规格，且库中同名仅 1 条时，按名称匹配  

## 数据准备

目录：`excel/flowProductMatchOnSales/`

| 文件 | 用途 |
|------|------|
| `material.xlsx` | 羊肉、猪肉 |
| `bom.xlsx` | 初始餐品+BOM（含规格） |
| `sales_loose_ok.xlsx` | 红烧羊肉/中份（库仅大份） |
| `sales_strict_ok.xlsx` | 宫保鸡丁/大份 |
| `sales_multi_db_fail.xlsx` | 回锅肉/中份（库有大份+小份） |
| `sales_multi_scale_upload.xlsx` | 青椒肉丝中份+小份 |
| `bom_scale_mismatch.xlsx` | 酸菜鱼/中份、是否新增=否 |

## 本用例覆盖

| 场景 | 期望 |
|------|------|
| 宽松匹配成功 | 导入成功，挂到库中唯一同名餐品 |
| 严格匹配 | 导入成功 |
| 库同名多条 | `checked=false`，不导入 |
| 上传同名多规格 | 不进入宽松匹配，导入失败 |
| BOM 报错文案 | 错误含「名称已匹配」「规格未匹配」 |

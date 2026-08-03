/**
 * 生成 FlowUploadSalesRecoredByDay 用的 excel 测试数据
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('C:/jswork/supplychain/node_modules/xlsx-js-style');

function writeExcel(filePath, rows) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const headers = Object.keys(rows[0]);
  const datas = [headers, ...rows.map(row => headers.map(h => row[h]))];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(datas);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  fs.writeFileSync(filePath, XLSX.write(wb, { type: 'buffer' }));
  console.log('wrote', filePath);
}

const root = path.join('C:/jswork/supplyTest/excel/salesRecord');

writeExcel(path.join(root, 'material.xlsx'), [
  { 物料名称: '羊肉', 物料单位: '斤', 分类: '肉类', 物料规格: '', 价格: 10, 供应商: '肉类供应商', 物料编码: 'M_YANG', 档口: '' },
  { 物料名称: '牛肉', 物料单位: '斤', 分类: '肉类', 物料规格: '', 价格: 20, 供应商: '肉类供应商', 物料编码: 'M_NIU', 档口: '' }
]);

// 多物料菜品：后续行菜品名称留空，导入时沿用上一菜品（与现有 bom 样例一致）
writeExcel(path.join(root, 'bom.xlsx'), [
  { 菜品名称: '红烧羊肉', 菜品编码: 'P001', 菜品规格: '', 物料名称: '羊肉', 物料单位: '斤', 净料数量: '', 毛料数量: 1, 单位比例: '', 采购单价: '', 采购单位: '', 物料编码: 'M_YANG', 是否新增: '' },
  { 菜品名称: '红烧牛肉', 菜品编码: 'P002', 菜品规格: '', 物料名称: '牛肉', 物料单位: '斤', 净料数量: '', 毛料数量: 1, 单位比例: '', 采购单价: '', 采购单位: '', 物料编码: 'M_NIU', 是否新增: '' },
  { 菜品名称: '羊肉炒牛肉', 菜品编码: 'P003', 菜品规格: '', 物料名称: '羊肉', 物料单位: '斤', 净料数量: '', 毛料数量: 0.5, 单位比例: '', 采购单价: '', 采购单位: '', 物料编码: 'M_YANG', 是否新增: '' },
  { 菜品名称: '', 菜品编码: '', 菜品规格: '', 物料名称: '牛肉', 物料单位: '斤', 净料数量: '', 毛料数量: 0.5, 单位比例: '', 采购单价: '', 采购单位: '', 物料编码: 'M_NIU', 是否新增: '' }
]);

writeExcel(path.join(root, 'sales1.xlsx'), [
  { 菜品名称: '红烧羊肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/01', 销售数量: 10 },
  { 菜品名称: '红烧牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/01', 销售数量: 11 },
  { 菜品名称: '羊肉炒牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/01', 销售数量: 12 }
]);

writeExcel(path.join(root, 'sales2.xlsx'), [
  { 菜品名称: '红烧羊肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/01', 销售数量: 10 },
  { 菜品名称: '红烧牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/02', 销售数量: 12 },
  { 菜品名称: '羊肉炒牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/02', 销售数量: 13 }
]);

writeExcel(path.join(root, 'sales3.xlsx'), [
  { 菜品名称: '红烧羊肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/02', 销售数量: 20 },
  { 菜品名称: '红烧牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/02', 销售数量: 22 },
  { 菜品名称: '羊肉炒牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/02', 销售数量: 23 }
]);

writeExcel(path.join(root, 'sales4.xlsx'), [
  { 菜品名称: '红烧羊肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/03', 销售数量: 30 },
  { 菜品名称: '红烧牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/03', 销售数量: 32 },
  { 菜品名称: '羊肉炒牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/03', 销售数量: 33 }
]);

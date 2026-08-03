/**
 * 生成 FlowStateMaterialAndProdcut 用的销售记录 excel
 * 菜品消耗见 bom：红烧羊肉=羊肉10克/份、红烧牛肉=牛肉0.1包/份、炒猪肉=猪肉10克/份、
 * 猪肉炖粉条=猪肉20克+牛肉0.05包/份（多物料餐品；猪/牛各被两个餐品复用，使用频次=2）
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

const root = path.join('C:/jswork/supplyTest/excel/state');

// 6/10：羊-50g 牛-40g 猪-60g
writeExcel(path.join(root, 'sales0610.xlsx'), [
  { 菜品名称: '红烧羊肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/06/10', 销售数量: 5 },
  { 菜品名称: '红烧牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/06/10', 销售数量: 4 },
  { 菜品名称: '炒猪肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/06/10', 销售数量: 6 }
]);

// 6/20：羊-30g 牛-30g(红烧牛肉20g+炖粉条10g) 猪-80g(炒猪肉40g+炖粉条40g)
writeExcel(path.join(root, 'sales0620.xlsx'), [
  { 菜品名称: '红烧羊肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/06/20', 销售数量: 3 },
  { 菜品名称: '红烧牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/06/20', 销售数量: 2 },
  { 菜品名称: '炒猪肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/06/20', 销售数量: 4 },
  { 菜品名称: '猪肉炖粉条', 菜品编码: '', 菜品规格: '', 营业日期: '2026/06/20', 销售数量: 2 }
]);

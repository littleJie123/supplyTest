/**
 * 生成 FlowDatas 用的销售记录 excel
 * 红烧牛肉 2份 + 水煮牛肉 1份，营业日期必须是字符串 2026/07/03（不要用 Excel 日期序列）
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

const filePath = path.join('C:/jswork/supplyTest/excel/datas/sales0703.xlsx');
writeExcel(filePath, [
  { 菜品名称: '红烧牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/03', 销售数量: 2 },
  { 菜品名称: '水煮牛肉', 菜品编码: '', 菜品规格: '', 营业日期: '2026/07/03', 销售数量: 1 }
]);

/**
 * 生成 FlowUpload 物料编码匹配订单 excel
 */
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '../../supplychain/node_modules/xlsx-js-style'));

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

const root = path.join(__dirname, '../excel/upload');

writeExcel(path.join(root, '[FU]上传订单_物料编码.xlsx'), [
  { 物料名称: '啤酒不存在', 物料单位: '公斤', 供应商: '供应商2', 价格: 12, 物料数量: 1, 订单日期: '2026-09-01', 物料编码: 'beer' }
]);

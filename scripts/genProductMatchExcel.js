/**
 * 生成 FlowProductMatchOnSales 用的 excel 测试数据
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

function bomRow(opt) {
  return {
    菜品名称: opt.name ?? '',
    菜品编码: opt.code ?? '',
    菜品规格: opt.scale ?? '',
    物料名称: opt.material,
    物料单位: '斤',
    净料数量: '',
    毛料数量: 1,
    单位比例: '',
    采购单价: '',
    采购单位: '',
    物料编码: opt.materialCode ?? '',
    是否新增: opt.needAdd ?? ''
  };
}

const root = path.join('C:/jswork/supplyTest/excel/flowProductMatchOnSales');

writeExcel(path.join(root, 'material.xlsx'), [
  { 物料名称: '羊肉', 物料单位: '斤', 分类: '肉类', 物料规格: '', 价格: 10, 供应商: '肉类供应商', 物料编码: 'M_YANG', 档口: '' },
  { 物料名称: '猪肉', 物料单位: '斤', 分类: '肉类', 物料规格: '', 价格: 15, 供应商: '肉类供应商', 物料编码: 'M_ZHU', 档口: '' }
]);

// 初始 BOM：带规格创建餐品（后续销售匹配用）
writeExcel(path.join(root, 'bom.xlsx'), [
  bomRow({ name: '红烧羊肉', code: 'P_YANG', scale: '大份', material: '羊肉', materialCode: 'M_YANG' }),
  bomRow({ name: '宫保鸡丁', code: 'P_GB', scale: '大份', material: '猪肉', materialCode: 'M_ZHU' }),
  bomRow({ name: '回锅肉', code: 'P_HG_D', scale: '大份', material: '猪肉', materialCode: 'M_ZHU' }),
  bomRow({ name: '回锅肉', code: 'P_HG_X', scale: '小份', material: '猪肉', materialCode: 'M_ZHU' }),
  bomRow({ name: '青椒肉丝', code: 'P_QJ', scale: '大份', material: '猪肉', materialCode: 'M_ZHU' }),
  bomRow({ name: '酸菜鱼', code: 'P_SCY_D', scale: '大份', material: '羊肉', materialCode: 'M_YANG' }),
  bomRow({ name: '酸菜鱼', code: 'P_SCY_X', scale: '小份', material: '羊肉', materialCode: 'M_YANG' })
]);

writeExcel(path.join(root, 'sales_loose_ok.xlsx'), [
  { 菜品名称: '红烧羊肉', 菜品编码: '', 菜品规格: '中份', 营业日期: '2026/07/01', 销售数量: 10 }
]);

writeExcel(path.join(root, 'sales_strict_ok.xlsx'), [
  { 菜品名称: '宫保鸡丁', 菜品编码: '', 菜品规格: '大份', 营业日期: '2026/07/01', 销售数量: 5 }
]);

writeExcel(path.join(root, 'sales_multi_db_fail.xlsx'), [
  { 菜品名称: '回锅肉', 菜品编码: '', 菜品规格: '中份', 营业日期: '2026/07/01', 销售数量: 8 }
]);

writeExcel(path.join(root, 'sales_multi_scale_upload.xlsx'), [
  { 菜品名称: '青椒肉丝', 菜品编码: '', 菜品规格: '中份', 营业日期: '2026/07/01', 销售数量: 3 },
  { 菜品名称: '青椒肉丝', 菜品编码: '', 菜品规格: '小份', 营业日期: '2026/07/01', 销售数量: 4 }
]);

writeExcel(path.join(root, 'bom_scale_mismatch.xlsx'), [
  bomRow({ name: '酸菜鱼', scale: '中份', material: '羊肉', materialCode: 'M_YANG', needAdd: '否' })
]);

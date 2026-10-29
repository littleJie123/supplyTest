/**
 * 生成 FlowOtherUseUpload 用的 excel，表头与 excel_target_col.target_col 一致。
 */
const fs = require('fs')
const path = require('path')
const XLSX = require(path.join(__dirname, '../../supplychain/node_modules/xlsx-js-style'))

function writeExcel(filePath, headers, rows) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const datas = [headers, ...rows]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(datas)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  fs.writeFileSync(filePath, XLSX.write(wb, { type: 'buffer' }))
  console.log('wrote', filePath)
}

const root = path.join(__dirname, '../excel/flowOtherUseUpload')
const instockHead = ['物料名称', '物料编码', '物料单位', '物料数量', '日期', '类型', '价格']
const useHead = ['物料名称', '物料编码', '物料单位', '物料数量', '日期', '类型']

writeExcel(path.join(root, '其他入库错误.xlsx'), instockHead, [
  ['牛肉', '', '克', 100, '2026-01-01', '白拿', 1],
  ['猪肉1', '', '包', 100, '2026-01-01', '白拿', 2],
  ['羊肉', '', '包', 100, '2026-01-01', '赠予', 3]
])

writeExcel(path.join(root, '其他入库正确.xlsx'), instockHead, [
  ['牛肉', '', '克', 100, '2026-01-01', '天上掉的', 1],
  ['猪肉1', 'zhurou', '包', 100, '2026-01-01', '天上掉的', 2],
  ['羊肉', '', '包', 10, '2026-01-02', '赠予', 3],
  ['羊肉', '', '包', 20, '2026-01-02', '赠予', 4],
  ['猪肉', '', '包', 20, '2026-01-03', '赠予', 5]
])

writeExcel(path.join(root, '其他消耗错误.xlsx'), useHead, [
  ['牛肉', '', '克', 10, '2026-01-04', '赠予'],
  ['猪肉1', '', '包', 10, '2026-01-04', '报损'],
  ['羊肉', '', '包', 1, '2026-01-04', '报损']
])

writeExcel(path.join(root, '其他消耗正确.xlsx'), useHead, [
  ['牛肉', '', '克', 40, '2026-01-04', '报损'],
  ['猪肉', 'zhurou', '包', 20, '2026-01-04', '报损'],
  ['羊肉', '', '包', 5, '2026-01-05', '员工餐'],
  ['羊肉', '', '包', 5, '2026-01-05', '员工餐']
])

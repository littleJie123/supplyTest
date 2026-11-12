/**
 * 生成 FlowOtherUse 导入用的 excel。
 * 规格跟 PreTestWithMeat：猪肉按克，西瓜按个，牛肉按包。
 * 成功导入不再带日期、类型。错误文件仍带这两列，用来确认服务端不再校验它们。
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

const root = path.join(__dirname, '../excel/flowOtherUse')
const instockHead = ['物料名称', '物料编码', '物料单位', '物料数量', '价格']
const useHead = ['物料名称', '物料编码', '物料单位', '物料数量']
const instockHeadOld = ['物料名称', '物料编码', '物料单位', '物料数量', '日期', '类型', '价格']
const useHeadOld = ['物料名称', '物料编码', '物料单位', '物料数量', '日期', '类型']

writeExcel(path.join(root, '其他入库错误.xlsx'), instockHeadOld, [
  ['牛肉', '', '包', 1, '2026-07-20', '白拿', 10],
  ['猪肉1', '', '克', 100, '2026-07-20', '白拿', 2],
  ['西瓜', '', '个', 1, '2026-07-20', '赠予', 10]
])

writeExcel(path.join(root, '其他入库天上掉的.xlsx'), instockHead, [
  ['猪肉', 'MAT003', '克', 100, 2]
])

writeExcel(path.join(root, '其他入库赠予.xlsx'), instockHead, [
  ['西瓜', '', '个', 1, 20]
])

writeExcel(path.join(root, '其他消耗错误.xlsx'), useHeadOld, [
  ['牛肉', '', '包', 1, '2026-07-22', '赠予'],
  ['猪肉1', '', '克', 1, '2026-07-22', '报损'],
  ['西瓜', '', '个', 1, '2026-07-22', '报损']
])

writeExcel(path.join(root, '其他消耗员工餐.xlsx'), useHead, [
  ['西瓜', '', '个', 1],
  ['西瓜', '', '个', 1]
])

const oldRoot = path.join(__dirname, '../excel/flowOtherUseUpload')
if (fs.existsSync(oldRoot)) {
  for (let name of fs.readdirSync(oldRoot)) {
    let filePath = path.join(oldRoot, name)
    fs.unlinkSync(filePath)
    console.log('removed', filePath)
  }
  fs.rmdirSync(oldRoot)
  console.log('removed dir', oldRoot)
}

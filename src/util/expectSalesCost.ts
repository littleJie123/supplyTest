import { CheckUtil } from "testflow";

/** 与 NumUtil.toNum(n, 4) 一致 */
export function round4(num: number): number {
  let x = num * 10000
  let ret = Math.round(x)
  if (Math.abs(x - (ret + 1)) < 0.001) {
    ret = ret + 1
  }
  return ret / 10000
}

/**
 * 有 BOM：noBom=0，且 cost = 该记录 salesRecordBom 各行 cost 之和 × cnt（4 位）。
 * 没 BOM：noBom=1，cost=0，没有有效副本。
 */
export function expectSalesCost(records: any[], copies: any[], label: string) {
  CheckUtil.expectEqual(records != null && records.length > 0, true, `${label}应有销售记录`)
  let copyMap: { [id: string]: any[] } = {}
  for (let row of copies ?? []) {
    let key = String(row.salesRecordId)
    if (copyMap[key] == null) {
      copyMap[key] = []
    }
    copyMap[key].push(row)
  }
  for (let row of records) {
    let rows = copyMap[String(row.salesRecordId)] ?? []
    if (Number(row.noBom) === 1) {
      CheckUtil.expectEqual(Number(row.cost), 0, `${label} noBom=1 时 cost 应为0，salesRecordId=${row.salesRecordId}`)
      CheckUtil.expectEqual(rows.length, 0, `${label} noBom=1 不应有副本，salesRecordId=${row.salesRecordId}`)
      continue
    }
    CheckUtil.expectEqual(Number(row.noBom), 0, `${label} 有BOM时 noBom 应为0，salesRecordId=${row.salesRecordId}`)
    CheckUtil.expectEqual(rows.length > 0, true, `${label} 应有 salesRecordBom，salesRecordId=${row.salesRecordId}`)
    let one = 0
    for (let copy of rows) {
      one += Number(copy.cost ?? 0)
    }
    let expected = round4(one * Number(row.cnt ?? 0))
    CheckUtil.expectEqual(
      Number(row.cost),
      expected,
      `${label} cost 应为副本合计×数量 ${expected}，实际=${row.cost}，salesRecordId=${row.salesRecordId}`
    )
  }
}

/**
 * 上传 excel 后组装 saveExcel 的 fileCols。
 * 与客户端 UploadExcel 一致：excelFileColId 来自 uploadExcel，targetCol 为系统列名。
 */
export default class ExcelUploadUtil {
  /** excel 表头简称 → 系统 targetCol */
  static readonly COL_ALIAS: { [col: string]: string } = {
    '单位': '物料单位',
    '数量': '物料数量',
    '日期': '订单日期',
    '规格': '物料规格',
    '挡位': '档口',
    '门店名称': '餐厅名称'
  };

  /**
   * @param fileCols uploadExcel 返回的 fileCols
   */
  static buildSaveFileCols(fileCols: any[]): { excelFileColId: number; targetCol: string }[] {
    let ret: { excelFileColId: number; targetCol: string }[] = [];
    for (let row of fileCols ?? []) {
      if (row.excelFileColId == null) {
        continue;
      }
      let targetCol = row.targetCol;
      if (targetCol == null || targetCol === '') {
        targetCol = ExcelUploadUtil.COL_ALIAS[row.col];
      }
      if (targetCol == null || targetCol === '') {
        continue;
      }
      ret.push({
        excelFileColId: row.excelFileColId,
        targetCol
      });
    }
    return ret;
  }
}

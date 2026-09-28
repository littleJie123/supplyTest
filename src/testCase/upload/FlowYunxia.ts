import { BaseTest, CheckUtil, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import AddSupplier from "../../action/supplier/AddSupplier";
import Upload from "../../action/Upload";
import path from "path";
import Action from "../../action/Action";
import ExcelUploadUtil from "../../util/ExcelUploadUtil";

export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),
      new AddSupplier('北京滇美云祥商贸有限公司'),
      new AddSupplier('丹东企鹅叮咚商贸有限公司'),
      new AddSupplier('北京昀衡商贸'),
      ... this.buildUpload('云下/云下物料', 'material'),

      ... this.buildUpload('云下/bom', 'bom', { needSave: true }),

      ... this.buildUpload('云下/订单', 'purcharse'),

      ... this.buildUpload('云下/销售数据', 'salesRecord', { needSave: true }),
      ... this.buildUpload('云下/3月份盘点', 'inventory', { needSave: true }),
      ... this.buildUpload('云下/4月份盘点', 'inventory', { needSave: true }),
      //this.buildUpload('云下/订单[物料]', 'material'),
      //this.buildUpload('云下/bom[物料]', 'material'),
    ]
    return ret;
  }

  buildUpload(url: string, target: String, opt?: {
    needSave: boolean
  }): BaseTest[] {
    let needSave = !!opt?.needSave;
    let ret: BaseTest[] = [new Upload({
      name: '上传' + target,
      param: {
        target: target,
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile(url),

    }, {
      check(result) {
        if (!needSave) {
          let data = result.result;
          if (data?.allMap) {
            CheckUtil.expectEqual(data.importResult?.checked, true)
          }
        }
      },
      buildVariable(result) {
        let data = result.result ?? {};
        return {
          excelFileId: data.excelFileId,
          fileCols: ExcelUploadUtil.buildSaveFileCols(data.fileCols),
          allMap: !!data.allMap
        }
      }
    })
    ]
    let saveAfterProcess = needSave ? undefined : {
      needRunVariable: {
        key: 'allMap',
        not: true
      },
      check(result) {
        CheckUtil.expectEqual(result.result?.checked, true)
      }
    }
    ret.push(
      new Action({
        name: 'saveExcel',
        remark: needSave ? undefined : '列未全部自动匹配时再保存导入',
        url: '/app/excel/saveExcel',
        param: {
          excelFileId: '${excelFileId}',
          fileCols: '${fileCols}',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, saveAfterProcess)
    )
    return ret;
  }
  getName(): string {
    return '云下导入'
  }
  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    let dir = path.join(__dirname, '../../../excel/', strPath)
    return dir;
  }
}
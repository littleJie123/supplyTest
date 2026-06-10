import { BaseTest, CheckUtil, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import AddSupplier from "../../action/supplier/AddSupplier";
import Upload from "../../action/Upload";
import path from "path";
import Action from "../../action/Action";

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
  
    let ret: BaseTest[] = [new Upload({
      name: '上传' + target,
      param: {
        target: target,
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile(url),

    }, {
      check(result) {
        if(!opt?.needSave){
          result = result.result.importResult;
          CheckUtil.expectEqual(result.checked, true)
        }
      },
      buildVariable(result) {
        result = result.result;
        let fileCols = result.fileCols;
        fileCols = fileCols.filter(row => row.targetCol != null);
        fileCols = fileCols.map(row => ({ targetCol: row.targetCol, excelFileId: row.excelFileId }))
        return {
          excelFileId: result.excelFileId,
          fileCols
        }
      }
    })
    ]
    if (opt?.needSave) {
      ret.push(
        new Action({
          name: 'saveExcel',
          url: '/app/excel/saveExcel',
          param: {
            excelFileId: '${excelFileId}',
            fileCols: '${fileCols}',
            warehouseId: '${warehouse.warehouseId}'
          }
        })
      )
    }
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
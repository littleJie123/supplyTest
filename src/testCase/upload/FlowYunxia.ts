import { BaseTest, CheckUtil, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import AddSupplier from "../../action/supplier/AddSupplier";
import Upload from "../../action/Upload";
import path from "path";

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
      this.buildUpload('云下/云下物料', 'material'),
      //this.buildUpload('云下/订单[物料]', 'material'),
      //this.buildUpload('云下/bom[物料]', 'material'),
    ]
    return ret;
  }

  buildUpload(url: string, target: String) {
    return new Upload({
      name: '上传' + target,
      param: {
        target: target,
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile(url),

    }, {
      check(result) {

        result = result.result.importResult;
        CheckUtil.expectEqual(result.checked, true) 
      }
    })
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
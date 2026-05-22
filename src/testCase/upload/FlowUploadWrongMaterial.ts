import { BaseTest, CheckUtil, TestCase } from "testflow";
import SaveMaterial from "../../action/material/SaveMaterial";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import Upload from "../../action/Upload";
import path from "path";

export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),
      new SaveMaterial({
        name: '卷心菜',
        buyUnit: [
          {
            "fee": 1,
            "name": "斤",
            "isSupplier": false
          },
          {
            "isSupplier": true,
            "name": "箱",
            "fee": 10
          }
        ]
      })
    ]

    ret.push(new Upload({
      name: '上传物料',
      param: {
        target: 'material',
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile('错误物料')
    },{
      check(result){

        result = result.result.importResult;
        CheckUtil.expectEqual(result.checked ,false)
        CheckUtil.expectEqual(result.errors.length,2);
      }
    }))

    return ret;
  }
  getName(): string {
    return '错误的物料上传';
  }

  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    let dir = path.join(__dirname, '../../../excel/', strPath)
    return dir;
  }

}
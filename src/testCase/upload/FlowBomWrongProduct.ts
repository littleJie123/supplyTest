import { BaseTest, CheckUtil, TestCase } from "testflow";
import SaveMaterial from "../../action/material/SaveMaterial";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
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

    ]

    ret.push(new Upload({
      name: '上传物料',
      param: {
        target: 'material',
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile('物料')
    }))

    ret.push(new Action({
      name: '新增餐品',
      param: { "name": "烤羊肉【牛】" },
      url: '/app/product/addProduct'
    }))

    ret.push(new Upload({
      name: '上传bom【新增否】',
      param: { target: 'bom' },
      filePath: this.getFile('bom【新增否】')
    }))

    ret.push(new Action({
      name: '查询餐品',
      param: {},
      url: '/app/product/listProduct'
    }, {
      buildVariable(result) {

      },

      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqualArray(content, [

          {
            "name": "烤羊肉【牛】"

          },
          {
            "name": "卷心菜炒猪肉",
          }
        ]);

      }
    }))

    return ret;
  }
  getName(): string {
    return '上传bom【新增餐品】';
  }

  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    let dir = path.join(__dirname, '../../../excel/', strPath)
    return dir;
  }

}
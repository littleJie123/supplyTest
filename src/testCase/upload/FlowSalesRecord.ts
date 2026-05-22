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

    ret.push(new Upload({
      name: '上传bom',
      param: {
        target: 'bom',
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile('bom')
    }))


    ret.push(new Upload({
      name: '上传销售记录',
      param: {
        target: 'salesRecord',
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile('销售记录')
    }))

    ret.push(new Action({
      name: '查询销售记录',
      url: '/app/salesRecord/listSalesRecord',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqual(content.length, 5);
      }
    }))

    ret.push(new Upload({
      name: '上传销售记录[错误]',
      param: {
        target: 'salesRecord',
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile('销售记录[错误]')
    }))

    ret.push(new Action({
      name: '查询销售记录',
      url: '/app/salesRecord/listSalesRecord',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        let content: any[] = result.result.content;
        CheckUtil.expectEqual(content.length, 6);
        let wrong = content.filter(row => row.cnt != 4)
        CheckUtil.expectEqual(wrong.length, 0);
      }
    }))


    return ret;
  }
  getName(): string {
    return '销售记录';
  }

  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    let dir = path.join(__dirname, '../../../excel/', strPath)
    return dir;
  }

}
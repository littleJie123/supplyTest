import { BaseTest, CheckUtil, TestCase } from "testflow";
import { expectSalesCost } from "../../util/expectSalesCost";
import SaveMaterial from "../../action/material/SaveMaterial";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
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

    ]

    ret.push(...this.buildUpload('上传物料', 'material', '物料'))
    ret.push(...this.buildUpload('上传bom', 'bom', 'bom'))
    ret.push(...this.buildUpload('上传销售记录', 'salesRecord', '销售记录'))

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

    ret.push(...this.buildUpload('上传销售记录[错误]', 'salesRecord', '销售记录[错误]'))

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

    ret.push(new Action({
      name: '校验cost、noBom和salesRecordBom',
      url: '/free/query',
      param: {
        array: [
          {
            table: 'salesRecord',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          },
          {
            table: 'salesRecordBom',
            query: {
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }
        ]
      }
    }, {
      check(result) {
        expectSalesCost(result.result?.salesRecord ?? [], result.result?.salesRecordBom ?? [], '上传销售记录')
      }
    }).setHighlight())


    return ret;
  }
  getName(): string {
    return '销售记录';
  }

  /**
   * 列能自动匹配时上传即导入；匹配不上时再 saveExcel。
   */
  private buildUpload(name: string, target: string, fileName: string): BaseTest[] {
    return [
      new Upload({
        name,
        param: {
          target,
          warehouseId: '${warehouse.warehouseId}'
        },
        filePath: this.getFile(fileName)
      }, {
        buildVariable(result) {
          let data = result.result ?? {}
          return {
            excelFileId: data.excelFileId,
            fileCols: ExcelUploadUtil.buildSaveFileCols(data.fileCols),
            allMap: !!data.allMap
          }
        }
      }),
      new Action({
        name: `保存${name}`,
        url: '/app/excel/saveExcel',
        param: {
          excelFileId: '${excelFileId}',
          fileCols: '${fileCols}',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        needRunVariable: {
          key: 'allMap',
          not: true
        }
      })
    ]
  }

  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    return path.join(__dirname, '../../../excel/FlowSalesRecord/', strPath)
  }

}
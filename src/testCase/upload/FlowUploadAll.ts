import { BaseTest, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import Upload from "../../action/Upload";
import path from "path";
import Action from "../../action/Action";

function getExportFile(name: string): string {
  if (!name.endsWith('.xlsx')) {
    name += '.xlsx';
  }
  return path.join(__dirname, '../../../excel/upload/', name);
}

/**
 * 上传 downloadAll 导出的单个 excel：列全部匹配则上传时直接导入，否则再 saveExcel。
 */
class UploadExportFile extends TestCase {
  private fileName: string;
  private target: string;

  constructor(fileName: string, target: string) {
    super({ remark: `上传 ${fileName}.xlsx，target=${target}` });
    this.fileName = fileName;
    this.target = target;
  }

  getName(): string {
    return `上传${this.fileName}`;
  }

  protected buildActions(): BaseTest[] {
    let name = `上传${this.fileName}`;
    let fileName = this.fileName;
    return [
      new Upload({
        name,
        remark: `上传 excel/upload/${fileName}.xlsx`,
        param: {
          target: this.target,
          warehouseId: '${warehouse.warehouseId}'
        },
        filePath: getExportFile(fileName)
      }, {
        buildVariable(result) {
          let checkResult = result.result.importResult;
          result = result.result;
          let fileCols = result.fileCols ?? [];
          fileCols = fileCols.filter(row => row.targetCol != null);
          fileCols = fileCols.map(row => ({
            targetCol: row.targetCol,
            excelFileId: row.excelFileId
          }));
          return {
            excelFileId: result.excelFileId,
            fileCols,
            uploadChecked: checkResult?.checked
          };
        }
      }),
      new Action({
        name: `saveExcel[${name}]`,
        remark: `列未全部自动匹配时保存导入 ${fileName}`,
        url: '/app/excel/saveExcel',
        param: {
          excelFileId: '${excelFileId}',
          fileCols: '${fileCols}',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        needRunVariable: {
          key: 'uploadChecked',
          not: true
        }
      })
    ];
  }
}

/**
 * 将 downloadAll 导出的 excel 重新导入到新仓库。
 * 详见 FlowUploadAll.md
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '将 downloadAll 导出的 excel 重新导入到新仓库' });
  }

  getName(): string {
    return '导入downloadAll导出数据';
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId().setRemark('查找最大测试用户'),
      new GetOpenId().setRemark('注册测试用户'),
      new AddWarehouse().setRemark('新建餐厅仓库'),
      new ChangeWarehouse().setRemark('切换到新建仓库'),
      new UploadExportFile('物料', 'material'),
      new UploadExportFile('bom', 'bom'),
      new UploadExportFile('订单', 'purcharse'),
      new UploadExportFile('销售记录', 'salesRecord'),
      new UploadExportFile('盘点数据', 'inventory')
    ];
  }
}

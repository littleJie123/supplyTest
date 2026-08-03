import { BaseTest, CheckUtil, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import Upload from "../../action/Upload";
import Action from "../../action/Action";
import path from "path";

/**
 * 销售记录导入时的餐品匹配（含宽松按名称匹配、规格不符报错）。
 * 详见 FlowProductMatchOnSales.md / supplychain/doc/餐品匹配_需求.md
 */
export default class extends TestCase {
  getName(): string {
    return '销售导入餐品匹配';
  }

  protected getFile(name: string): string {
    if (!name.endsWith('.xlsx')) {
      name += '.xlsx';
    }
    return path.join(__dirname, '../../../excel/flowProductMatchOnSales/', name);
  }

  /** 上传并保存 excel（与 UploadCase 一致） */
  private buildUpload(
    name: string,
    target: string,
    fileName: string,
    opt?: {
      check?(result: any): void;
      buildVariable?(result: any): any;
    }
  ): BaseTest[] {
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
          const checkResult = result.result.importResult;
          const data = result.result;
          let fileCols = (data.fileCols ?? []).filter((row: any) => row.targetCol != null);
          fileCols = fileCols.map((row: any) => ({
            targetCol: row.targetCol,
            excelFileId: row.excelFileId
          }));
          const base = {
            excelFileId: data.excelFileId,
            fileCols,
            uploadChecked: checkResult?.checked
          };
          if (opt?.buildVariable) {
            return { ...base, ...opt.buildVariable(result) };
          }
          return base;
        },
        check(result) {
          if (opt?.check) {
            opt.check(result);
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
          key: 'uploadChecked',
          not: true
        }
      })
    ];
  }

  private buildUploadSales(name: string, fileName: string, check?: (result: any) => void): BaseTest[] {
    return this.buildUpload(name, 'salesRecord', fileName, { check });
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),

      ...this.buildUpload('上传物料', 'material', 'material'),
      ...this.buildUpload('上传BOM', 'bom', 'bom'),

      // —— 1. 宽松匹配：规格不同但库同名唯一 ——
      ...this.buildUploadSales('销售宽松匹配成功', 'sales_loose_ok', (result) => {
        const importResult = result.result.importResult;
        CheckUtil.expectEqual(importResult?.checked, true, '红烧羊肉规格不同应宽松匹配成功');
      }),
      new Action({
        name: '校验宽松匹配后的销售记录',
        url: '/app/salesRecord/listSalesRecord',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          salesDate: '2026-07-01'
        }
      }, {
        check(result) {
          const content: any[] = result.result.content ?? [];
          const row = content.find(item => item.product?.name === '红烧羊肉');
          CheckUtil.expectEqual(row != null, true, '应导入红烧羊肉销售');
          CheckUtil.expectEqual(row.cnt, 10);
        }
      }),
      new Action({
        name: '校验宽松匹配挂到大份餐品',
        url: '/free/query',
        param: {
          array: [{
            table: 'salesRecord',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              isDel: 0
            }
          }, {
            table: 'product',
            query: {
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              name: '红烧羊肉',
              isDel: 0
            }
          }]
        }
      }, {
        check(result) {
          const data = result.result;
          const sales: any[] = data.salesRecord ?? [];
          const products: any[] = data.product ?? [];
          CheckUtil.expectEqual(products.length, 1, '红烧羊肉库中应仅一条');
          const matched = sales.find(s => s.productId === products[0].productId);
          CheckUtil.expectEqual(matched != null, true, '销售应挂到库中唯一红烧羊肉');
          CheckUtil.expectEqual(products[0].scaleName, '大份');
        }
      }),

      // —— 2. 严格 name+scale 匹配 ——
      ...this.buildUploadSales('销售严格匹配成功', 'sales_strict_ok', (result) => {
        const importResult = result.result.importResult;
        CheckUtil.expectEqual(importResult?.checked, true, '宫保鸡丁同名同规格应匹配成功');
      }),
      new Action({
        name: '校验严格匹配销售记录',
        url: '/app/salesRecord/listSalesRecord',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          salesDate: '2026-07-01'
        }
      }, {
        check(result) {
          const content: any[] = result.result.content ?? [];
          const row = content.find(item => item.product?.name === '宫保鸡丁');
          CheckUtil.expectEqual(row != null, true);
          CheckUtil.expectEqual(row.cnt, 5);
        }
      }),

      // —— 3. 库同名多条：不能宽松匹配 ——
      ...this.buildUploadSales('销售库同名多条失败', 'sales_multi_db_fail', (result) => {
        const importResult = result.result.importResult;
        CheckUtil.expectEqual(importResult?.checked, false, '回锅肉同名多规格不应宽松匹配');
      }),
      new Action({
        name: '确认回锅肉未导入',
        url: '/app/salesRecord/listSalesRecord',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          salesDate: '2026-07-01'
        }
      }, {
        check(result) {
          const content: any[] = result.result.content ?? [];
          const row = content.find(item => item.product?.name === '回锅肉');
          CheckUtil.expectEqual(row == null, true, '回锅肉不应导入成功');
        }
      }),

      // —— 4. 上传同名多规格：不进入宽松 ——
      ...this.buildUploadSales('销售上传同名多规格失败', 'sales_multi_scale_upload', (result) => {
        const importResult = result.result.importResult;
        CheckUtil.expectEqual(importResult?.checked, false, '上传同名多规格不应宽松匹配');
      }),
      new Action({
        name: '确认青椒肉丝未导入',
        url: '/app/salesRecord/listSalesRecord',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          salesDate: '2026-07-01'
        }
      }, {
        check(result) {
          const content: any[] = result.result.content ?? [];
          const rows = content.filter(item => item.product?.name === '青椒肉丝');
          CheckUtil.expectEqual(rows.length, 0, '青椒肉丝不应导入');
        }
      }),

      // —— 5. BOM 是否新增=否 + 规格不符 → 报错文案 ——
      ...this.buildUpload('BOM规格不符报错文案', 'bom', 'bom_scale_mismatch', {
        buildVariable(result) {
          return {
            bomErrorNo: result.result.importResult?.errorNo
          };
        },
        check(result) {
          const importResult = result.result.importResult;
          CheckUtil.expectEqual(importResult?.checked, false, '酸菜鱼规格不符应报错');
        }
      }),
      new Action({
        name: '校验规格未匹配报错文案',
        url: '/free/query',
        param: {
          array: [{
            table: 'excelError',
            query: {
              errorNo: '${bomErrorNo}',
              errorCode: 'noProduct'
            }
          }]
        }
      }, {
        check(result) {
          const array: any[] = result.result?.excelError ?? [];
          const hit = array.find((row: any) => {
            const msg = row.errorMsg ?? '';
            return msg.includes('名称已匹配') && msg.includes('规格未匹配');
          });
          CheckUtil.expectEqual(hit != null, true, '应提示名称已匹配但规格未匹配');
          if (hit) {
            CheckUtil.expectEqual(String(hit.errorMsg).includes('中份'), true);
            CheckUtil.expectEqual(
              String(hit.errorMsg).includes('大份') || String(hit.errorMsg).includes('小份'),
              true
            );
          }
        }
      })
    ];
  }
}

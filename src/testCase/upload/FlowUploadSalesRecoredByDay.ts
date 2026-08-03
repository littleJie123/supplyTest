import { BaseTest, CheckUtil, DateUtil, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import Upload from "../../action/Upload";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import GetMap from "../../action/GetMap";
import CheckCnt from "../../action/CheckCnt";
import CheckStock from "../../action/CheckStock";
import CheckArray from "../../action/CheckArray";
import DelSalesByDay from "../../action/salesRecord/DelSalesByDay";
import path from "path";

/**
 * 按日多次上传销售记录，验证删除再上传后库存与 stockRecord 是否正确。
 * 详见 FlowUploadSalesRecoredByDay.md
 */
export default class extends TestCase {
  getName(): string {
    return '按日多次上传销售记录';
  }

  protected getFile(name: string): string {
    if (!name.endsWith('.xlsx')) {
      name += '.xlsx';
    }
    return path.join(__dirname, '../../../excel/salesRecord/', name);
  }

  /** 上传并保存 excel（与 UploadCase 一致） */
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
          // Upload 返回体与 UploadCase 一致：外层再包一层 result
          const checkResult = result.result.importResult;
          result = result.result;
          let fileCols = (result.fileCols ?? []).filter((row: any) => row.targetCol != null);
          fileCols = fileCols.map((row: any) => ({
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

  /**
   * recal + 校验库存数量/金额 + sales 相关条数 + 可选 7/1 出库记录数为 0
   * 羊肉 10元/斤、牛肉 20元/斤 → 库存金额 = 数量 * 单价
   */
  private buildVerify(opt: {
    name: string;
    sheep: number;
    beef: number;
    salesRecordCnt: number;
    salesStockCnt: number;
    salesStockRecordCnt: number;
    checkJuly1SalesRecordZero?: boolean;
  }): BaseTest[] {
    const variable = this.getVariable();
    const sheepCost = opt.sheep * 10;
    const beefCost = opt.beef * 20;
    const ret: BaseTest[] = [
      new Recal(),
      new CheckStock({
        array: [
          { materialId: '${material.羊肉}', cnt: opt.sheep },
          { materialId: '${material.牛肉}', cnt: opt.beef }
        ]
      }),
      new CheckArray([{
        table: 'stock',
        check(array) {
          const sheepId = variable.material?.['羊肉'];
          const beefId = variable.material?.['牛肉'];
          const sheep = array.find((row: any) => String(row.materialId) === String(sheepId));
          const beef = array.find((row: any) => String(row.materialId) === String(beefId));
          CheckUtil.expectEqual(sheep != null, true, `${opt.name}:羊肉库存不存在`);
          CheckUtil.expectEqual(beef != null, true, `${opt.name}:牛肉库存不存在`);
          CheckUtil.expectEqual(sheep.cost, sheepCost, `${opt.name}:羊肉库存金额不对`);
          CheckUtil.expectEqual(beef.cost, beefCost, `${opt.name}:牛肉库存金额不对`);
        }
      }]),
      new CheckCnt([
        { table: 'salesRecord', cnt: opt.salesRecordCnt },
        { table: 'salesStock', cnt: opt.salesStockCnt, notWarhouseId: true },
        {
          table: 'stockRecord',
          cnt: opt.salesStockRecordCnt,
          query: { type: 'sales' }
        }
      ])
    ];
    if (opt.checkJuly1SalesRecordZero) {
      ret.push(new CheckArray([{
        table: 'stockRecord',
        query: {
          type: 'sales',
          warehouseId: '${warehouse.warehouseId}'
        },
        check(array) {
          const july1 = array.filter((row: any) => {
            const d = DateUtil.formatDate(new Date(row.bussinessDate));
            return d.startsWith('2026-07-01');
          });
          CheckUtil.expectEqual(july1.length, 0, `${opt.name}:7月1日仍有type=sales且isDel=0的stockRecord`);
        }
      }]));
    }
    return ret;
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),

      ...this.buildUpload('上传物料', 'material', 'material'),
      ...this.buildUpload('上传BOM', 'bom', 'bom'),
      new GetMap(),

      // 盘点：6/30 各 100 斤；羊肉 10元/斤→成本1000，牛肉 20元/斤→成本2000
      new Action({
        name: '盘点羊肉牛肉各100斤',
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          bussinessDate: '2026-06-30',
          array: [
            {
              materialId: '${material.羊肉}',
              cnt: 100,
              buyUnitFee: 1,
              cost: 1000
            },
            {
              materialId: '${material.牛肉}',
              cnt: 100,
              buyUnitFee: 1,
              cost: 2000
            }
          ]
        }
      }),

      // —— 销售1：全部 7/1 —— 羊-16 牛-17 → 84 / 83
      ...this.buildUpload('上传销售记录1', 'salesRecord', 'sales1'),
      ...this.buildVerify({
        name: '销售1后',
        sheep: 84,
        beef: 83,
        salesRecordCnt: 3,
        salesStockCnt: 4,
        salesStockRecordCnt: 4
      }),

      // —— 删除 7/1，库存回 100 ——
      new DelSalesByDay('2026-07-01'),
      ...this.buildVerify({
        name: '删除7/1后',
        sheep: 100,
        beef: 100,
        salesRecordCnt: 0,
        salesStockCnt: 0,
        salesStockRecordCnt: 0,
        checkJuly1SalesRecordZero: true
      }),

      // —— 销售2：红烧羊肉10@7/1 + 红烧牛肉12@7/2 + 炒13@7/2 ——
      // 羊 10+6.5=16.5 → 83.5；牛 12+6.5=18.5 → 81.5
      ...this.buildUpload('上传销售记录2', 'salesRecord', 'sales2'),
      ...this.buildVerify({
        name: '销售2后',
        sheep: 83.5,
        beef: 81.5,
        salesRecordCnt: 3,
        salesStockCnt: 4,
        salesStockRecordCnt: 4
      }),

      // —— 再删 7/1（只剩红烧羊肉10）→ 羊+10 → 93.5 / 81.5 ——
      new DelSalesByDay('2026-07-01'),
      ...this.buildVerify({
        name: '再删7/1后',
        sheep: 93.5,
        beef: 81.5,
        salesRecordCnt: 2,
        salesStockCnt: 3,
        salesStockRecordCnt: 3,
        checkJuly1SalesRecordZero: true
      }),

      // —— 销售3：全部改到 7/2（同日同品更新）——
      // 红烧羊20 + 炒11.5 = 31.5 → 68.5；红烧牛22 + 炒11.5 = 33.5 → 66.5
      ...this.buildUpload('上传销售记录3', 'salesRecord', 'sales3'),
      ...this.buildVerify({
        name: '销售3后',
        sheep: 68.5,
        beef: 66.5,
        salesRecordCnt: 3,
        salesStockCnt: 4,
        salesStockRecordCnt: 4,
        checkJuly1SalesRecordZero: true
      }),

      // —— 销售4：全部新增 7/3（叠加在 7/2 之上）——
      // 7/3 消耗羊 30+16.5=46.5、牛 32+16.5=48.5 → 库存 68.5-46.5=22 / 66.5-48.5=18
      ...this.buildUpload('上传销售记录4', 'salesRecord', 'sales4'),
      ...this.buildVerify({
        name: '销售4后',
        sheep: 22,
        beef: 18,
        salesRecordCnt: 6,
        salesStockCnt: 8,
        salesStockRecordCnt: 8,
        checkJuly1SalesRecordZero: true
      })
    ];
  }
}

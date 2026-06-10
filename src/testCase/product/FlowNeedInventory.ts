import { BaseTest, CheckUtil, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import UploadCase from "../../action/UploadCase";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import Action from "../../action/Action";
import Recal from "../../action/Recal";

export default class extends TestCase {
  protected buildActions(): BaseTest[] {

    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),
      new UploadCase({
        target: 'material'
      }),
      new UploadCase({
        target: 'bom',
        sheetName: 'bom'
      }),

      new UploadCase({
        target: 'purcharse',
        sheetName: '订单'
      }),

      new UploadCase({
        target: 'salesRecord',
        sheetName: '销售记录'
      }),

      new UploadCase({
        target: 'inventory',
        sheetName: '盘点'
      }),

      new Recal(),



      new Action({
        url: '/app/state/stateEigenvalue',
        name: '计算特征值',
        param: {
          "warehouseId": '${warehouse.warehouseId}',

          "begin": "2026-04-01",
          "end": "2026-04-20"
        },

      }, {
        check(result) {
          result = result.result; 
          CheckUtil.expectEqualObj(result,
            {
              "needInventoryMaterialCnt": 3,
            }
          )
        }
      }),

      new Action({
        url: '/app/state/needInventoryMaterial',
        name: '查询需要盘点物料',
        param: {
          "warehouseId": '${warehouse.warehouseId}',

          "begin": "2026-04-01",
          "end": "2026-04-20"
        },

      }, {
        check(result) {
          result = result.result;
          let content = result.content;
          let pig = content.find(row=>row.name=='猪肉')
          CheckUtil.expectEqual(pig == null,true)

        }
      }),
      new Action({
        url: '/app/state/needInventoryMaterial',
        name: '查询需要盘点物料2',
        param: {
          "warehouseId": '${warehouse.warehouseId}',
          "begin": "2026-04-01",
          "end": "2026-04-26"
        },

      }, {
        check(result) {
          result = result.result;
          let content = result.content;
          CheckUtil.expectEqual(content.length,4);
        }
      }),

      new Action({
        url: '/app/state/noSalesDays',
        name: '没有销售记录日期',
        param: {
          "warehouseId": '${warehouse.warehouseId}',
          "begin": "2026-04-01",
          "end": "2026-04-20"
        },

      }, {
        check(result) {
          let array:any[] = result.result;
          CheckUtil.expectEqual(array.length,20-3)
          let map = {
            '2026-04-10':true,
            '2026-04-11':true,
            '2026-04-12':true,
          }
          array = array.filter(row=>map[row])
          CheckUtil.expectEqual(array.length,0)
        }
      })



    ]
  }
  getName(): string {
    return '销售日期和需要盘点数量'
  }

}
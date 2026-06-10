import { ArrayUtil, BaseTest, CheckUtil, TestCase, UploadAction } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import Action from "../../action/Action";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import UploadCase from "../../action/UploadCase";
import Recal from "../../action/Recal";
import GetMap from "../../action/GetMap";
import CheckCnt from "../../action/CheckCnt";
import CheckStock from "../../action/CheckStock";
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
        index: 1
      }),

      new UploadCase({
        target: 'purcharse',
        index: 2
      }),

      new UploadCase({
        target: 'salesRecord',
        index: 3
      }),
      new Recal(),
      new GetMap(),
      new CheckCnt([
        {
          table: 'salesRecord',
          cnt: 5
        },
        {
          table: 'salesStock',
          cnt: 10,
          notWarhouseId: true
        },
        {
          table: 'stockRecord',
          cnt: 10,
          query: {
            type: 'sales'
          }

        }
      ]),
      new CheckStock({
        array: [
          {
            materialId: '${material.猪肉}',
            cnt: 1000 - 10 * 4
          },
          {
            materialId: '${material.羊肉}',
            cnt: 1000 - 10 * 4
          },
          {
            materialId: '${material.青菜}',
            cnt: 1000 - 30 * 2
          },
          {
            materialId: '${material.豆腐}',
            cnt: 1000 - 30 * 2
          }


        ]
      }),

      new UploadCase({
        target: 'salesRecord',
        index: 4
      }),
      new Recal(),

      new CheckStock({
        array: [
          {
            materialId: '${material.猪肉}',
            cnt: 1000 - 10 * 8
          },
          {
            materialId: '${material.羊肉}',
            cnt: 1000 - 10 * 8
          },
          {
            materialId: '${material.青菜}',
            cnt: 1000 - 20 * 8
          },
          {
            materialId: '${material.豆腐}',
            cnt: 1000 - 20 * 8
          }


        ]
      }),
      new CheckCnt([
        {
          table: 'salesRecord',
          cnt: 6
        },
        {
          table: 'salesStock',
          cnt: 12,
          notWarhouseId: true
        },
        {
          table: 'stockRecord',
          cnt: 12,
          query: {
            type: 'sales'
          }

        }
      ]),

      new Action({
        name: '查询销售记录',
        url: '/app/salesRecord/listSalesRecord',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          salesDate: '2026-04-12'
        }
      }, {
        buildVariable(result) {
          result = result.result;
          let content = result.content;
          return {
            salesRecord: ArrayUtil.toMapByKey(content, 'product.name', 'salesRecordId')
          }
        }
      }),

      new Action({
        name: '修改销售记录',
        url: '/app/salesRecord/updateSalesRecord',
        param: {
          salesRecordId: '${salesRecord.青菜炒豆腐}',
          cnt: 5
        }
      }),
      new Recal(),

      new CheckStock({
        array: [
          {
            materialId: '${material.猪肉}',
            cnt: 1000 - 10 * 8
          },
          {
            materialId: '${material.羊肉}',
            cnt: 1000 - 10 * 8
          },
          {
            materialId: '${material.青菜}',
            cnt: 1000 - 20 * 9
          },
          {
            materialId: '${material.豆腐}',
            cnt: 1000 - 20 * 9
          }


        ]
      }),

      new Action({
        name: '增加销售记录',
        url: '/app/salesRecord/addSalesRecord',
        param: {
          productId: '${product.青菜炒豆腐}',
          cnt: 2,
          salesDate: '2026-04-13',
          warehouseId: '${warehouse.warehouseId}'
        }
      }),

      new Recal(),

      new CheckStock({
        array: [
          {
            materialId: '${material.猪肉}',
            cnt: 1000 - 10 * 8
          },
          {
            materialId: '${material.羊肉}',
            cnt: 1000 - 10 * 8
          },
          {
            materialId: '${material.青菜}',
            cnt: 1000 - 20 * 11
          },
          {
            materialId: '${material.豆腐}',
            cnt: 1000 - 20 * 11
          }


        ]
      }),

      new Action({
        name: '删除销售记录',
        url: '/app/salesRecord/delSalesRecord',
        param: {
          salesRecordId: '${salesRecord.青菜炒豆腐}'
        }
      }),

      new Recal(),

      new CheckStock({
        array: [
          {
            materialId: '${material.猪肉}',
            cnt: 1000 - 10 * 8
          },
          {
            materialId: '${material.羊肉}',
            cnt: 1000 - 10 * 8
          },
          {
            materialId: '${material.青菜}',
            cnt: 1000 - 20 * 6
          },
          {
            materialId: '${material.豆腐}',
            cnt: 1000 - 20 * 6
          }


        ]
      }),
      new CheckCnt([
        {
          table: 'salesRecord',
          cnt: 6
        },
        {
          table: 'salesStock',
          cnt: 12,
          notWarhouseId: true
        },
        {
          table: 'stockRecord',
          cnt: 12,
          query: {
            type: 'sales'
          }

        }
      ]),
      new Action({
        name: '查询销售日期',
        url: '/app/salesRecord/listSalesDay',
        param: {
          "warehouseId": '${warehouse.warehouseId}',
          "begin": "2026-04-01",
          "end": "2026-04-30"
        }
      }, {
        check(result) {
          let content = result.result.content;
          CheckUtil.expectEqualArray(content, [
            {
              "salesDate": "2026-04-10",
              "productCnt": 2,
              "cnt": 2
            },
            {
              "salesDate": "2026-04-11",
              "productCnt": 2,
              "cnt": 6
            },
            {
              "salesDate": "2026-04-12",
              "productCnt": 1,
              "cnt": 4
            },
            {
              "salesDate": "2026-04-13",
              "productCnt": 1,
              "cnt": 2
            }
          ])
        }
      })
    ]
  }





  getName() {
    return '销售记录管理【上传、修改、新增、删除、修改】'
  }


}
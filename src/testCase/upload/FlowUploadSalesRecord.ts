import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import { expectSalesCost, round4 } from "../../util/expectSalesCost";
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

function querySalesAndBom(salesQuery?: any): any {
  return {
    array: [
      {
        table: 'salesRecord',
        query: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0,
          ...(salesQuery ?? {})
        }
      },
      {
        table: 'salesRecordBom',
        query: {
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          isDel: 0,
          ...(salesQuery?.salesRecordId != null ? { salesRecordId: salesQuery.salesRecordId } : {})
        }
      }
    ]
  }
}

export default class extends TestCase {


  protected buildActions(): BaseTest[] {
    const variable = this.getVariable()
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
      new Action({
        name: '校验首次上传的cost和副本',
        url: '/free/query',
        param: querySalesAndBom()
      }, {
        check(result) {
          let records = result.result?.salesRecord ?? []
          let copies = result.result?.salesRecordBom ?? []
          expectSalesCost(records, copies, '首次上传')
          CheckUtil.expectEqual(copies.length, 10, `首次上传 salesRecordBom 应为10行，实际=${copies.length}`)
        }
      }).setHighlight(),
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
        name: '校验再次上传的cost和副本',
        url: '/free/query',
        param: querySalesAndBom()
      }, {
        check(result) {
          let records = result.result?.salesRecord ?? []
          let copies = result.result?.salesRecordBom ?? []
          expectSalesCost(records, copies, '再次上传')
          CheckUtil.expectEqual(copies.length, 12, `再次上传 salesRecordBom 应为12行，实际=${copies.length}`)
        }
      }).setHighlight(),

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
        name: '记下青菜炒豆腐的BOM副本',
        url: '/free/query',
        param: querySalesAndBom({ salesRecordId: '${salesRecord.青菜炒豆腐}' })
      }, {
        check(result) {
          expectSalesCost(result.result?.salesRecord ?? [], result.result?.salesRecordBom ?? [], '改数量前')
        },
        buildVariable(result) {
          let copies: any[] = result.result?.salesRecordBom ?? []
          let one = 0
          for (let row of copies) {
            one += Number(row.cost ?? 0)
          }
          return {
            tofuBomIds: copies.map(row => Number(row.salesRecordBomId)).sort((a, b) => a - b).join(','),
            tofuOneCost: one
          }
        }
      }).setHighlight(),

      new Action({
        name: '修改销售记录',
        url: '/app/salesRecord/updateSalesRecord',
        param: {
          salesRecordId: '${salesRecord.青菜炒豆腐}',
          cnt: 5
        }
      }),
      new Recal(),
      new Action({
        name: '校验改数量后的cost和副本',
        url: '/free/query',
        param: querySalesAndBom({ salesRecordId: '${salesRecord.青菜炒豆腐}' })
      }, {
        check(result) {
          let record = (result.result?.salesRecord ?? [])[0]
          let copies: any[] = result.result?.salesRecordBom ?? []
          CheckUtil.expectEqual(record != null, true, '改数量后应能查到青菜炒豆腐')
          CheckUtil.expectEqual(Number(record.cnt), 5, `改数量后 cnt 应为5，实际=${record?.cnt}`)
          CheckUtil.expectEqual(Number(record.noBom), 0, '改数量不改 noBom')
          let ids = copies.map(row => Number(row.salesRecordBomId)).sort((a, b) => a - b).join(',')
          CheckUtil.expectEqual(ids, variable.tofuBomIds, `改数量不应重建 salesRecordBom，原=${variable.tofuBomIds}，现=${ids}`)
          expectSalesCost([record], copies, '改数量后')
          CheckUtil.expectEqual(
            Number(record.cost),
            round4(Number(variable.tofuOneCost) * 5),
            `改数量后 cost 应按原副本×5，实际=${record.cost}`
          )
        }
      }).setHighlight(),

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
      new Action({
        name: '校验新增销售的cost和副本',
        url: '/app/salesRecord/listSalesRecord',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          salesDate: '2026-04-13'
        }
      }, {
        check(result) {
          let row = (result.result.content ?? [])[0]
          CheckUtil.expectEqual(row != null, true, '4月13日应有新增销售')
          CheckUtil.expectEqual(Number(row.cnt), 2, `新增数量应为2，实际=${row?.cnt}`)
          CheckUtil.expectEqual(Number(row.noBom), 0, '有BOM的新增 noBom 应为0')
          CheckUtil.expectEqual(
            Number(row.cost),
            round4(Number(variable.tofuOneCost) * 2),
            `新增 cost 应按当前BOM×2，实际=${row?.cost}`
          )
        },
        buildVariable(result) {
          return { addedSalesRecordId: result.result.content[0].salesRecordId }
        }
      }).setHighlight(),
      new Action({
        name: '校验新增的salesRecordBom',
        url: '/free/query',
        param: querySalesAndBom({ salesRecordId: '${addedSalesRecordId}' })
      }, {
        check(result) {
          expectSalesCost(result.result?.salesRecord ?? [], result.result?.salesRecordBom ?? [], '新增')
        }
      }).setHighlight(),

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
      }),
      new Action({
        name: '校验删除后的BOM副本',
        url: '/free/query',
        param: {
          array: [
            {
              table: 'salesRecordBom',
              key: 'alive',
              query: {
                salesRecordId: '${salesRecord.青菜炒豆腐}',
                warehouseGroupId: '${warehouse.warehouseGroupId}',
                isDel: 0
              }
            },
            {
              table: 'salesRecordBom',
              key: 'deleted',
              query: {
                salesRecordId: '${salesRecord.青菜炒豆腐}',
                warehouseGroupId: '${warehouse.warehouseGroupId}',
                isDel: 1
              }
            }
          ]
        }
      }, {
        check(result) {
          let alive = result.result?.alive ?? []
          let deleted = result.result?.deleted ?? []
          CheckUtil.expectEqual(alive.length, 0, `删除后有效副本应为0，实际=${alive.length}`)
          CheckUtil.expectEqual(deleted.length > 0, true, '删除后原副本应标为已删除')
        }
      }).setHighlight(),
      new Action({
        name: '增加无BOM餐品',
        url: '/app/product/addProduct',
        param: { name: '_test_无BOM菜' }
      }, {
        buildVariable(result) {
          return { noBomProductId: result.result.productId }
        }
      }),
      new Action({
        name: '增加无BOM销售',
        url: '/app/salesRecord/addSalesRecord',
        param: {
          productId: '${noBomProductId}',
          cnt: 3,
          salesDate: '2026-04-20',
          warehouseId: '${warehouse.warehouseId}'
        }
      }),
      new Action({
        name: '校验无BOM销售',
        url: '/free/query',
        param: querySalesAndBom({ productId: '${noBomProductId}' })
      }, {
        check(result) {
          let records = result.result?.salesRecord ?? []
          let copies = result.result?.salesRecordBom ?? []
          CheckUtil.expectEqual(records.length, 1, `无BOM销售应为1条，实际=${records.length}`)
          expectSalesCost(records, copies, '无BOM')
        }
      }).setHighlight()
    ]
  }





  getName() {
    return '销售记录管理【上传、修改、新增、删除、修改】'
  }


}
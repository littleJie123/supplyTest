import { BaseTest, TestCase } from "testflow";
import PreTest from "./PreTest";
import Action from "../action/Action";
import QueryAction from "../action/QueryAction";
import PreCreateNoteAndLink from "./PreCreateNoteAndLink";

export default class extends TestCase {
  getName(): string {
    return '修改记录'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest(),
      new Action({
        name: '修改供应商',
        url: '/app/supplier/updateSupplier',
        param: {
          supplierId: "${supplierMap.供应商1}",
          name: '供应商A'
        }
      }),
      new QueryAction({
        name: '查询修改记录',
        url: '/app/updateHis/listUpdateHis',
        query: {
          tableId: '${supplierMap.供应商1}',
          tableName: 'supplier'
        },
        checkers: {
          checkArray: [
            {
              data: {
                name: '供应商1'
              }
            },
            {
              data: {
                name: '供应商A'
              }
            }
          ]
        }
      }),
      new Action({
        headers: {
          token: '${token}'
        },
        name: '修改仓库',
        url: '/app/warehouse/updateWarehouse',
        param: {
          warehouseId: "${warehouse.warehouseId}",
          name: '新餐厅2'
        }
      }),
      new Action({
        headers: {
          token: '${token}'
        },
        name: '修改仓库',
        url: '/app/warehouse/updateWarehouse',
        param: {
          warehouseId: "${warehouse.warehouseId}",
          name: '新餐厅3'
        }
      }),
      new QueryAction({
        name: '查询修改记录',
        url: '/app/updateHis/listUpdateHis',
        query: {
          tableId: '${warehouse.warehouseId}',
          tableName: 'warehouse'
        },
        checkers: {
          checkArray: [
            {
              data: {
                name: '新餐厅'
              }
            },
            {
              data: {
                name: '新餐厅2'
              }
            },
            {
              data: {
                name: '新餐厅3'
              }
            }
          ]
        }
      }),
      ... new PreCreateNoteAndLink({
        supplierName: '供应商A'
      }).getActions(),
      new QueryAction({
        name: '查询记录[要有link]',
        url: '/app/updateHis/listUpdateHis',
        query: {
          ids: [
            ['${supplierMap.供应商1}', 'supplier'],
            ['${supplierMap.供应商1}', 'Supplier_Link'],
            ["${supplierWarehouse.warehouseId}", 'warehouse'],
            ["${supplierWarehouse.warehouseId}", 'Supplier_Link']
          ]

        },
        checkers: {
          checkArray: [
            {
              tableName: 'Supplier_Link'

            }
          ]
        }
      })
    ]
  }
}
import { ArrayUtil, BaseTest, TestCase } from "testflow";
import PreCreateNoteAndLink from "./PreCreateNoteAndLink";
import Action from "../action/Action";
import PreTest from "./PreTest";
import ListMaterial from "../action/material/ListMaterial";
import QueryAction from "../action/QueryAction";

export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    return [
      new PreTest,
      new PreCreateNoteAndLink(),
      new Action({
        name: '批量新建物料',
        url: '/app/material/batchAdd',
        param: {

          array: [{ unitsId: 18, buyUnitId: 201, stockUnitsId: 5, name: "鸡肉" }]

        }

      }, {

        warehouseType: 'supplierWarehouse'
      }),

      new ListMaterial({
        type: 'supplierWarehouse',
      }),
      new QueryAction({
        url: '/app/supplier/listSupplier',
      }, {
        warehouseType: 'supplierWarehouse',
        buildVariable(result) {
          let content = result.result.content;
          return {
            supplierMap: ArrayUtil.toMapByKey(content, 'name', 'supplierId')
          }
        },
      }),


      new Action({
        name: '上传发货单',
        url: '/app/note/importNote',
        param: this.buildImportNoteParam()

      }, {
        warehouseType: 'supplierWarehouse'
      }),
      new QueryAction({
        url: '/app/note/listNote',
        query: {
          status: "normal",
          warehouseId: '${warehouse.warehouseId}',
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content
          let note = content.find(item => item.materialCnt == 3);
          return {

            noteId: note.noteId
          }
        }
      }),
      new QueryAction({
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${noteId}'
        },
        checkers: {
          checkArray: [
            {
              name: '猪肉',
              purcharse: {
                "cnt": 20,
                "buyUnitFee": 1
              }
            },
            {
              name: '羊肉',
              purcharse: {
                "cnt": 30,
                "buyUnitFee": 1
              }
            },
            {
              name: '鸡肉',
              purcharse: {
                "cnt": 400,
                "buyUnitFee": 1
              }
            }
          ]
        }
      })



    ]
  }

  buildImportNoteParam() {
    let param = {
      "array": [
        {
          "material": {
            "name": "猪肉",
            "id": 6287,
            "param": {
              unitsId: 18
            }
          },
          "units": {
            "name": "瓶",
            "id": 18,
            "param": 18
          },
          "buyUnit": {
            "name": "瓶",
            "id": 132,
            "param": {
              "unitsIds": "18",
              "fees": "1",
              "buyUnitId": 132
            }
          },
          "supplierMaterial": {
            "name": 10
          },
          "note": {
            "name": 20
          },
          "supplier": {
            "name": "新餐厅",
            "id": 1338
          }
        },
        {
          "material": {
            "name": "羊肉",
            "id": 6288,
            "param": {
              unitsId: 29
            }
          },
          "units": {
            "name": "瓶",
            "id": 29,
            "param": 18
          },
          "buyUnit": {
            "name": "1瓶=500g",
            "id": 146,
            "param": {
              "unitsIds": "29,18",
              "fees": "1,500",
              "buyUnitId": 146
            }

          },
          "supplierMaterial": {
            "name": 20
          },
          "note": {
            "name": 30
          },
          "supplier": {
            "name": "新餐厅",
            "id": 1338
          }
        },
        {
          "material": {
            "name": "鸡肉",
            "id": 6289,
            param: {
              "unitsId": 18,
            }
          },
          "units": {
            "name": "箱",
            "id": 18,
            "param": 5
          },
          "buyUnit": {
            "name": "1箱=10瓶",
            "id": 201,
            "param": {
              "unitsIds": "18,5",
              "fees": "1,10",
              "buyUnitId": 201
            }
          },
          "supplierMaterial": {
            "name": 30
          },
          "note": {
            "name": 40
          },
          "supplier": {
            "name": "新餐厅",
            "id": 1338
          }
        }
      ],
      "warehouseId": "${supplierWarehouse.warehouseId}",
      "type": "send",
      "warehouseGroupId": "${supplierWarehouse.warehouseGroupId}"
    }
    let array: any[] = param.array;
    for (let item of array) {
      item.material.id = `\${materialMap.${item.material.name}.materialId}`
      item.supplier.id = `\${supplierMap.${item.supplier.name}}`
    }
    return param;
  }
  getName(): string {
    return '供应商创建订单'
  }

}
import { BaseTest, CheckUtil, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import AddSupplier from "../../action/supplier/AddSupplier";
import Upload from "../../action/Upload";
import path from "path";
import Action from "../../action/Action";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
export default class extends TestCase {
  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    let dir = path.join(__dirname, '../../../excel/', strPath)
    return dir;
  }


  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
            new ChangeWarehouse(),
    ]
    ret.push(... this.getUploadActions({
      warehouseName: '测试上传'
    }))

    ret.push(
      new Action({
        name: '查询物料',
        url: '/app/material/listMaterialByCategory',
        param: {
          warehouseId: '${warehouse.warehouseId}',
        }
      }, {
        check: (result) => {
          let content = result.result.content;
          CheckUtil.expectEqual(content.length, 3);

          CheckUtil.expectEqualArray(content,
            this.getMaterialList(),
            {
              notCheckCols: [
                'materialId',
                'stallMaterials',
                'supplierMaterial.supplierMaterialId',
                'supplierMaterial.supplierId',
                'category.categoryId',
                'supplier.supplierId',
                'sysAddTime'
              ]

            }
          )
        }
      })
    )


    return ret;
  }

  private getMaterialList(): any[] {
    return [
      {
        "materialId": 46386,
        "name": "卷心菜",
        "pinyin": "juanxincai",
        "firstPinyin": "jxc",
        "buyUnit": [
          {
            "unitsId": 29,
            "fee": 1,
            "isUnits": true,
            "name": "克"
          },
          {
            "unitsId": 16,
            "fee": 500,
            "isSupplier": true,
            "name": "包"
          }
        ],
        "unitsId": 29,
        "stockUnitsId": 16,
        "category": {
          "categoryId": 3230,
          "name": "蔬菜",
          "firstPinyin": "sc"
        },
        "supplier": {
          "supplierId": 3777,
          "name": "蔬菜供应商",
          "moa": 0
        },
        "supplierMaterial": {
          "buyUnitFee": -500,
          "supplierMaterialId": 14308,
          "stockUnitsId": 16,
          "price": 10,
          "moc": 0,
          "supplierId": 3777
        },
        "sysAddTime": "2026-05-11 16:03:45",
        "remark": "",
        "buyUnitId": 112,
        "stallMaterials": [
          {
            "stallId": 5203,
            "stall": {
              "stallId": 5203,
              "name": "热菜"
            }
          },
          {
            "stallId": 5204,
            "stall": {
              "stallId": 5204,
              "name": "饮料"
            }
          }
        ],
        "code": "001"
      },
      {
        "materialId": 46387,
        "name": "猪肉",
        "pinyin": "zhurou",
        "firstPinyin": "zr",
        "buyUnit": [
          {
            "unitsId": 27,
            "fee": 1,
            "isUnits": true,
            "name": "千克"
          },
          {
            "unitsId": 16,
            "fee": 2,
            "name": "包"
          },
          {
            "unitsId": 5,
            "fee": 10,
            "isSupplier": true,
            "name": "箱"
          }
        ],
        "unitsId": 27,
        "stockUnitsId": 5,
        "category": {
          "categoryId": 3231,
          "name": "肉类",
          "firstPinyin": "rl"
        },
        "supplier": {
          "supplierId": 3778,
          "name": "肉类供应商",
          "moa": 0
        },
        "supplierMaterial": {
          "buyUnitFee": -20,
          "supplierMaterialId": 14309,
          "stockUnitsId": 5,
          "price": 20,
          "moc": 0,
          "supplierId": 3778
        },
        "sysAddTime": "2026-05-11 16:03:45",
        "remark": "",
        "buyUnitId": 1287,
        "stallMaterials": [
          {
            "stallId": 5203,
            "stall": {
              "stallId": 5203,
              "name": "热菜"
            }
          }
        ],
        "code": "002"
      },
      {
        "materialId": 46388,
        "name": "羊肉",
        "pinyin": "yangrou",
        "firstPinyin": "yr",
        "buyUnit": [
          {
            "unitsId": 29,
            "fee": 1,
            "isUnits": true,
            "name": "克"
          },
          {
            "unitsId": 24,
            "fee": 500,
            "isSupplier": true,
            "name": "条"
          }
        ],
        "unitsId": 29,
        "stockUnitsId": 24,
        "category": {
          "categoryId": 3231,
          "name": "肉类",
          "firstPinyin": "rl"
        },
        "supplier": {
          "supplierId": 3778,
          "name": "肉类供应商",
          "moa": 0
        },
        "supplierMaterial": {
          "buyUnitFee": -500,
          "supplierMaterialId": 14310,
          "stockUnitsId": 24,
          "price": 30,
          "moc": 0,
          "supplierId": 3778
        },
        "sysAddTime": "2026-05-11 16:03:45",
        "remark": "",
        "buyUnitId": 1288,
        "stallMaterials": [
          {
            "stallId": 5203,
            "stall": {
              "stallId": 5203,
              "name": "热菜"
            }
          },
          {
            "stallId": 5205,
            "stall": {
              "stallId": 5205,
              "name": "冷菜"
            }
          }
        ],
        "code": "003"
      }
    ]
  }


  getUploadActions(opt?: {
    warehouseName?: string;
    fileName?: string
  }): BaseTest[] {
    return [
      new AddWarehouse({
        name: opt?.warehouseName ?? '测试上传'
      }),
      new ChangeWarehouse(),
      new Upload({
        name: '上传物料',
        param: {
          target: 'material',
          warehouseId: '${warehouse.warehouseId}',
        },
        filePath: this.getFile(opt?.fileName ?? '物料')
      })
    ]
  }

  getName(): string {
    return '上传'
  }
}
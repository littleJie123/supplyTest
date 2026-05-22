import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import SaveMaterial from "../../action/material/SaveMaterial";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import Upload from "../../action/Upload";
import path from "path";
import Action from "../../action/Action";

export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),

    ]

    ret.push(new Upload({
      name: '上传物料',
      param: {
        target: 'material',
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile('物料')
    }))

    ret.push(new Upload({
      name: '上传订单[错误]',
      param: {
        target: 'purcharse',
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile('note[错误]')
    }))

    ret.push(new Action({
      name: '查询订单',
      url: '/app/note/listNote',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        let content: any[] = result.result.content;
        CheckUtil.expectEqual(content.length, 5);
      },
      buildVariable(result) {
        let content: any[] = result.result.content;
        return {
          noteIds: ArrayUtil.toArray(content, 'noteId')
        }
      }
    }));


    ret.push(new Action({
      name: '查询订单物料',
      url: '/app/noteItem/listNoteItem',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        noteId: '${noteIds}'

      }
    }, {
      check:(result)=> {
        let content: any[] = result.result.content;
        CheckUtil.expectEqual(content.length, 7);
        CheckUtil.expectEqualArray(content,this.getContent(),{
          onlyCols:['supplierMaterial','instock']
        })
      }
    }));



    return ret;
  }

  private getContent(){
    return  [
        {
          "noteItemId": 10052935,
          "price": 500,
          "status": "normal",
          "supplierId": 4063,
          "stockUnitsId": 16,
          "linkNoteItemId": 0,
          "instockCost": 5000,
          "rate": 0,
          "statementCost": null,
          "linkStatementCost": null,
          "yieldRate": 1,
          "name": "卷心菜",
          "buyUnitId": 112,
          "categoryId": 3517,
          "pinyin": "juanxincai",
          "firstPinyin": "jxc",
          "unitsId": 29,
          "instock": {
            "cnt": 10,
            "buyUnitFee": -500
          },
          "back": {
            "cnt": 0,
            "buyUnitFee": -500
          },
          "materialId": 48191,
          "purcharse": {
            "cnt": 10,
            "buyUnitFee": -500
          },
          "sendCnt": {
            "cnt": 0,
            "buyUnitFee": -500
          },
          "linkInstockCnt": {
            "buyUnitFee": -500,
            "cnt": 0
          },
          "statementCnt": {
            "buyUnitFee": -500,
            "cnt": null
          },
          "linkStatementCnt": {
            "buyUnitFee": -500,
            "cnt": null
          },
          "supplierMaterial": {
            "buyUnitFee": -500,
            "price": 500
          },
          "linkPrice": {
            "buyUnitFee": -500,
            "price": 500
          },
          "stockBuyUnitFee": -500,
          "buyUnitFee": -500,
          "noteId": 11746,
          "sysAddTime": "2026-03-31T16:00:00.000Z",
          "type": "normal",
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
          ]
        },
        {
          "noteItemId": 10052936,
          "price": 500,
          "status": "normal",
          "supplierId": 4063,
          "stockUnitsId": 24,
          "linkNoteItemId": 0,
          "instockCost": 6000,
          "rate": 0,
          "statementCost": null,
          "linkStatementCost": null,
          "yieldRate": 1,
          "name": "羊肉",
          "buyUnitId": 1288,
          "categoryId": 3518,
          "pinyin": "yangrou",
          "firstPinyin": "yr",
          "unitsId": 29,
          "instock": {
            "cnt": 12,
            "buyUnitFee": -500
          },
          "back": {
            "cnt": 0,
            "buyUnitFee": -500
          },
          "materialId": 48193,
          "purcharse": {
            "cnt": 12,
            "buyUnitFee": -500
          },
          "sendCnt": {
            "cnt": 0,
            "buyUnitFee": -500
          },
          "linkInstockCnt": {
            "buyUnitFee": -500,
            "cnt": 0
          },
          "statementCnt": {
            "buyUnitFee": -500,
            "cnt": null
          },
          "linkStatementCnt": {
            "buyUnitFee": -500,
            "cnt": null
          },
          "supplierMaterial": {
            "buyUnitFee": -500,
            "price": 500
          },
          "linkPrice": {
            "buyUnitFee": -500,
            "price": 500
          },
          "stockBuyUnitFee": -500,
          "buyUnitFee": -500,
          "noteId": 11746,
          "sysAddTime": "2026-03-31T16:00:00.000Z",
          "type": "normal",
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
          ]
        },
        {
          "noteItemId": 10052937,
          "price": 20,
          "status": "normal",
          "supplierId": 4064,
          "stockUnitsId": 5,
          "linkNoteItemId": 0,
          "instockCost": 220,
          "rate": 0,
          "statementCost": null,
          "linkStatementCost": null,
          "yieldRate": 1,
          "name": "猪肉",
          "buyUnitId": 1287,
          "categoryId": 3518,
          "pinyin": "zhurou",
          "firstPinyin": "zr",
          "unitsId": 27,
          "instock": {
            "cnt": 11,
            "buyUnitFee": -10
          },
          "back": {
            "cnt": 0,
            "buyUnitFee": -10
          },
          "materialId": 48192,
          "purcharse": {
            "cnt": 11,
            "buyUnitFee": -10
          },
          "sendCnt": {
            "cnt": 0,
            "buyUnitFee": -10
          },
          "linkInstockCnt": {
            "buyUnitFee": -10,
            "cnt": 0
          },
          "statementCnt": {
            "buyUnitFee": -10,
            "cnt": null
          },
          "linkStatementCnt": {
            "buyUnitFee": -10,
            "cnt": null
          },
          "supplierMaterial": {
            "buyUnitFee": -10,
            "price": 20
          },
          "linkPrice": {
            "buyUnitFee": -10,
            "price": 20
          },
          "stockBuyUnitFee": -10,
          "buyUnitFee": -10,
          "noteId": 11747,
          "sysAddTime": "2026-03-31T16:00:00.000Z",
          "type": "normal",
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
          ]
        },
        {
          "noteItemId": 10052938,
          "price": 20,
          "status": "normal",
          "supplierId": 4064,
          "stockUnitsId": 5,
          "linkNoteItemId": 0,
          "instockCost": 280,
          "rate": 0,
          "statementCost": null,
          "linkStatementCost": null,
          "yieldRate": 1,
          "name": "猪肉",
          "buyUnitId": 1287,
          "categoryId": 3518,
          "pinyin": "zhurou",
          "firstPinyin": "zr",
          "unitsId": 27,
          "instock": {
            "cnt": 14,
            "buyUnitFee": -20
          },
          "back": {
            "cnt": 0,
            "buyUnitFee": -20
          },
          "materialId": 48192,
          "purcharse": {
            "cnt": 14,
            "buyUnitFee": -20
          },
          "sendCnt": {
            "cnt": 0,
            "buyUnitFee": -20
          },
          "linkInstockCnt": {
            "buyUnitFee": -20,
            "cnt": 0
          },
          "statementCnt": {
            "buyUnitFee": -20,
            "cnt": null
          },
          "linkStatementCnt": {
            "buyUnitFee": -20,
            "cnt": null
          },
          "supplierMaterial": {
            "buyUnitFee": -20,
            "price": 20
          },
          "linkPrice": {
            "buyUnitFee": -20,
            "price": 20
          },
          "stockBuyUnitFee": -20,
          "buyUnitFee": -20,
          "noteId": 11748,
          "sysAddTime": "2026-04-01T16:00:00.000Z",
          "type": "normal",
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
          ]
        },
        {
          "noteItemId": 10052939,
          "price": 20,
          "status": "normal",
          "supplierId": 4064,
          "stockUnitsId": 5,
          "linkNoteItemId": 0,
          "instockCost": 280,
          "rate": 0,
          "statementCost": null,
          "linkStatementCost": null,
          "yieldRate": 1,
          "name": "猪肉",
          "buyUnitId": 1287,
          "categoryId": 3518,
          "pinyin": "zhurou",
          "firstPinyin": "zr",
          "unitsId": 27,
          "instock": {
            "cnt": 14,
            "buyUnitFee": -20
          },
          "back": {
            "cnt": 0,
            "buyUnitFee": -20
          },
          "materialId": 48192,
          "purcharse": {
            "cnt": 14,
            "buyUnitFee": -20
          },
          "sendCnt": {
            "cnt": 0,
            "buyUnitFee": -20
          },
          "linkInstockCnt": {
            "buyUnitFee": -20,
            "cnt": 0
          },
          "statementCnt": {
            "buyUnitFee": -20,
            "cnt": null
          },
          "linkStatementCnt": {
            "buyUnitFee": -20,
            "cnt": null
          },
          "supplierMaterial": {
            "buyUnitFee": -20,
            "price": 20
          },
          "linkPrice": {
            "buyUnitFee": -20,
            "price": 20
          },
          "stockBuyUnitFee": -20,
          "buyUnitFee": -20,
          "noteId": 11749,
          "sysAddTime": "2026-04-02T16:00:00.000Z",
          "type": "normal",
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
          ]
        },
        {
          "noteItemId": 10052940,
          "price": 20,
          "status": "normal",
          "supplierId": 4064,
          "stockUnitsId": 24,
          "linkNoteItemId": 0,
          "instockCost": 280,
          "rate": 0,
          "statementCost": null,
          "linkStatementCost": null,
          "yieldRate": 1,
          "name": "羊肉",
          "buyUnitId": 1288,
          "categoryId": 3518,
          "pinyin": "yangrou",
          "firstPinyin": "yr",
          "unitsId": 29,
          "instock": {
            "cnt": 14,
            "buyUnitFee": -500
          },
          "back": {
            "cnt": 0,
            "buyUnitFee": -500
          },
          "materialId": 48193,
          "purcharse": {
            "cnt": 14,
            "buyUnitFee": -500
          },
          "sendCnt": {
            "cnt": 0,
            "buyUnitFee": -500
          },
          "linkInstockCnt": {
            "buyUnitFee": -500,
            "cnt": 0
          },
          "statementCnt": {
            "buyUnitFee": -500,
            "cnt": null
          },
          "linkStatementCnt": {
            "buyUnitFee": -500,
            "cnt": null
          },
          "supplierMaterial": {
            "buyUnitFee": -500,
            "price": 20
          },
          "linkPrice": {
            "buyUnitFee": -500,
            "price": 20
          },
          "stockBuyUnitFee": -500,
          "buyUnitFee": -500,
          "noteId": 11749,
          "sysAddTime": "2026-04-02T16:00:00.000Z",
          "type": "normal",
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
          ]
        },
        {
          "noteItemId": 10052941,
          "price": 500,
          "status": "normal",
          "supplierId": 4063,
          "stockUnitsId": 16,
          "linkNoteItemId": 0,
          "instockCost": 6500,
          "rate": 0,
          "statementCost": null,
          "linkStatementCost": null,
          "yieldRate": 1,
          "name": "卷心菜",
          "buyUnitId": 112,
          "categoryId": 3517,
          "pinyin": "juanxincai",
          "firstPinyin": "jxc",
          "unitsId": 29,
          "instock": {
            "cnt": 13,
            "buyUnitFee": -500
          },
          "back": {
            "cnt": 0,
            "buyUnitFee": -500
          },
          "materialId": 48191,
          "purcharse": {
            "cnt": 13,
            "buyUnitFee": -500
          },
          "sendCnt": {
            "cnt": 0,
            "buyUnitFee": -500
          },
          "linkInstockCnt": {
            "buyUnitFee": -500,
            "cnt": 0
          },
          "statementCnt": {
            "buyUnitFee": -500,
            "cnt": null
          },
          "linkStatementCnt": {
            "buyUnitFee": -500,
            "cnt": null
          },
          "supplierMaterial": {
            "buyUnitFee": -500,
            "price": 500
          },
          "linkPrice": {
            "buyUnitFee": -500,
            "price": 500
          },
          "stockBuyUnitFee": -500,
          "buyUnitFee": -500,
          "noteId": 11750,
          "sysAddTime": "2026-04-02T16:00:00.000Z",
          "type": "normal",
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
          ]
        }
      ]
  }

  getName(): string {
    return '订单';
  }

  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    let dir = path.join(__dirname, '../../../excel/', strPath)
    return dir;
  }

}
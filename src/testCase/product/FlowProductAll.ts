import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import PreNote from "../PreNote";
import BuildInventory from "../../action/case/BuildInventory";
export default class extends TestCase {
  beginMaterial: number;
  getName(): string {
    return '餐品模型[综合测试]'
  }

  private buildProductAndBom(): BaseTest[] {
    return [
      new Action({
        name: '增加餐品',
        url: '/app/product/addProduct',
        param: {
          name: '白菜猪肉'
        }
      }, {
        buildVariable(result) {
          result = result.result
          return {
            productId: result.productId
          }
        }
      }),
      new Action({
        name: '保存bom',
        url: '/app/bom/saveBom',
        param: {
          "productId": '${productId}',
          "boms": [
            {
              "materialId": '${materialMap.猪肉.materialId}',
              "cnt": 10,
              "buyUnitFee": 1,
              "yieldRate": 0.8,
              "netCnt": 8,
              "stockBuyUnitFee": -10,
              "price": 10
            },
            {
              "materialId": '${materialMap.白菜.materialId}',
              "cnt": 10,
              "buyUnitFee": 1,
              "yieldRate": 5,
              "netCnt": 5,
              "stockBuyUnitFee": -10,
              "price": 6
            },

          ]
        }
      }),
      new Action({
        name: '增加餐品',
        url: '/app/product/addProduct',
        param: {
          name: '红烧肉'
        }
      }, {
        buildVariable(result) {
          result = result.result
          return {
            productId: result.productId
          }
        }
      }),
      new Action({
        name: '保存bom',
        url: '/app/bom/saveBom',
        param: {
          "productId": '${productId}',
          "boms": [
            {
              "materialId": '${materialMap.猪肉.materialId}',
              "cnt": 5,
              "buyUnitFee": 1,
              "yieldRate": 0.8,
              "netCnt": 4,
              "stockBuyUnitFee": -10,
              "price": 12
            }


          ]
        }
      }),
    ]
  }
  /**
   * 
   * @returns 
   */
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [
      ... new PreTest().getActions(),
      ... this.buildProductAndBom()
    ]

    let pigOpt = {

      needInstock: true,
      cnt: 30,
      buyUnitFee: -10,
      price: 0.8,
      yieldRate: 0.8,
      names: ['猪肉'],
      stockBuyUnitFee: 1
    }

    let cabbageOpt = {
      needInstock: true,
      cnt: 30,
      buyUnitFee: -10,
      price: 0.5,
      yieldRate: 0.5,
      names: ['白菜'],
      stockBuyUnitFee: 1

    }

    ret.push(... this.buildNote(7, pigOpt))
    ret.push(... this.buildNote(7, cabbageOpt))

    ret.push(new Action({
      name: '查询餐品',
      url: '/app/product/listProduct',
      param: {}
    }, {
      buildVariable(result) {
        let content: any[] = result.result.content;
        return {
          product: ArrayUtil.toMapByKey(content, 'name', 'productId')
        }
      }
    }))
    ret.push(this.buildImportProduct())
    ret.push(new BuildInventory({
      dayCnt: 1,
      nameArray: ['猪肉', '白菜'],
      materialCnt: 50


    }))
    ret.push(new Action({
      name: '全部计算',
      url: '/free/stateMaterial/recalStateMaterial',
      param: {
        warehouseId: '${warehouse.warehouseId}'

      }
    }))
    ret.push(new Action({
      name: '验证AnalyseMaterialPriceOfProduct',
      url: '/app/state/analyseMaterialPriceOfProduct',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(7),
        end: StrDateUtil.beforeDay(1),
        materialId: '${materialMap.猪肉.materialId}',
        productId: '${product.白菜猪肉}'
      },

    }, {
      check(result) {
        CheckUtil.expectEqualObj(result.result, {
          "bomPrice": { "price": 10, "buyUnitFee": -10 },
          "theoryCost": 100,
          "cost": 157.33,
          "diffByPrice": -39.33,
          "diffByCnt": 96.66
        })
      }
    }))


    ret.push(new Action({
      name: '验证analyseMaterialOfProduct',
      url: '/app/state/analyseMaterialOfProduct',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(7),
        end: StrDateUtil.beforeDay(1),
        productId: '${product.白菜猪肉}'
      },

    }, {
      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqualArray(content,
          [
            {
              "materialId": 33634,
              "cost": 157.33,
              "theoryCost": 100,
              "name": "猪肉",
              "buyUnit": [
                {
                  "unitsId": 18,
                  "fee": 1,
                  "isUnits": true,
                  "name": "瓶"
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
              "materialId": 33638,
              "cost": 147.5,
              "theoryCost": 60,
              "name": "白菜",
              "buyUnit": [
                {
                  "unitsId": 18,
                  "fee": 1,
                  "isUnits": true,
                  "isSupplier": true,
                  "name": "瓶"
                }
              ]
            }
          ],
          {
            notCheckCols: ['materialId']
          }
        )
      }
    }))

    ret.push(new Action({
      name: '验证analyseProductsOfMaterial',
      url: '/app/state/analyseProductsOfMaterial',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(7),
        end: StrDateUtil.beforeDay(1),
        materialId: '${materialMap.猪肉.materialId}'
      },

    }, {
      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqualArray(content, [
          {
            "productId": "1662",
            "cost": 157.34,
            "bomPrice": {
              "price": 10,
              "buyUnitFee": -10
            },
            "theoryCost": 100,
            "diffByCnt": 96.67,
            "diffByPrice": -39.33,
            "product": {
              "productId": 1662,
              "name": "白菜猪肉"
            }
          },
          {
            "productId": "1663",
            "cost": 78.66,
            "bomPrice": {
              "price": 12,
              "buyUnitFee": -10
            },
            "theoryCost": 60,
            "diffByCnt": 57.99,
            "diffByPrice": -39.33,
            "product": {
              "productId": 1663,
              "name": "红烧肉"
            }
          }
        ], {
          notCheckCols: [
            'productId',
            'product.productId'
          ]
        })
      }
    }))
    return ret;
  }


  private buildImportProduct(): Action {
    let days = []

    days.push(... this.buildDay(2, 10))

    return new Action({
      name: '上传销售记录',
      url: '/app/salesRecord/importSalesRecord',
      param: {
        datas: days,
        warehouseId: '${warehouse.warehouseId}'
      }
    })
  }

  private buildDay(day: number, cnt: number): any[] {
    return [

      {
        product: {
          name: '白菜猪肉',
          id: '${product.白菜猪肉}'
        },
        salesRecord: {
          name: this.getDate(Math.abs(day))
        },
        cnt: {
          name: Math.abs(cnt)
        }
      }, {
        product: {
          name: '红烧肉',
          id: '${product.红烧肉}'
        },
        salesRecord: {
          name: this.getDate(Math.abs(day))
        },
        cnt: {
          name: Math.abs(cnt)
        }
      }
    ]
  }

  private getDate(day: number): number {
    let date = new Date();
    date = DateUtil.beforeDay(date, day);
    let ret = DateUtil.toExcelDateNum(date);

    return ret;
  }



  private buildNote(day: number, opt?: {
    needInstock?: boolean;
    needStatement?: boolean;
    handInstock?: boolean
    supplier?: string
    cnt?: number
    buyUnitFee?: number
    price?: number;
    instockCnt?: number;
    yieldRate?: number;
    names?: string[]
    stockBuyUnitFee?: number
  }): BaseTest[] {
    return new PreNote({
      ...opt,
      day
    }).getActions();
  }

}
import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import PreNote from "../PreNote";
import BuildInventory from "../../action/case/BuildInventory";
export default class extends TestCase {
  beginMaterial: number;
  getName(): string {
    return '餐品模型[analyseMaterialPriceOfProduct]'
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
      name: 'AnalyseMaterialPriceOfProduct',
      url: '/app/state/analyseMaterialPriceOfProduct',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(7),
        end: StrDateUtil.beforeDay(1),
        materialId: '${materialMap.猪肉.materialId}',
        productId: '${product.红烧肉}'
      }
    }))
    return ret;
  }

  private buildCheckAction(): BaseTest[] {
    let ret: BaseTest[] = []
    ret.push(
      new Action({
        name: 'bom出成率分析',
        url: '/app/state/compareYieldRate',
        param: {
          "warehouseId": '${warehouse.warehouseId}',

          "begin": StrDateUtil.beforeDay(7),
          "end": DateUtil.todayStr(),
          "materialId": '${materialMap.猪肉.materialId}'
        }
      }, {
        check(result) {
          let content = result?.result?.yieldOfProduct;
          CheckUtil.expectEqualArray(content, [
            {
              "materialId": 33459,
              "cnt": 10,
              "buyUnitFee": 1,
              "productId": 1561,
              "yieldRate": 0.5,
              "cost": 10,
              "changeCnts": [],
              "costOfYield": 0,
              "product": {

                "name": "红烧肉"
              }
            },
            {
              "materialId": 33459,
              "cnt": 10,
              "buyUnitFee": 1,
              "productId": 1562,
              "yieldRate": 0.5,
              "cost": 15,
              "changeCnts": [
                {
                  "cnt": 100,
                  "cost": 200,
                  "buyUnitFee": 1,
                  "begin": "2026-03-16",
                  "end": "2026-03-16",
                  "yieldRate": 0.8
                },
                {
                  "cnt": 100,
                  "cost": 200,
                  "buyUnitFee": 1,
                  "begin": "2026-03-16",
                  "end": "2026-03-18",
                  "yieldRate": 0.7
                },
                {
                  "cnt": 50,
                  "cost": 125,
                  "buyUnitFee": 1,
                  "begin": "2026-03-18",
                  "end": "2026-03-18",
                  "yieldRate": 0.6
                }
              ],
              "costOfYield": -225,
              "product": {

                "name": "白菜猪肉"
              }
            }
          ], {
            notCheckCols: ['materialId', 'productId']
          })
        }
      })
    )



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
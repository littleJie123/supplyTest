import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import PreNote from "../PreNote";
import BuildInventory from "../../action/case/BuildInventory";
export default class extends TestCase {
  beginMaterial: number;
  getName(): string {
    return '餐品模型'
  }


  private buildProductAndBom() {
    return [
      ... this.doBuildProductAndBom('白菜猪肉', ['猪肉', '白菜'], {
        price: 10,
        stockBuyUnitFee: -10
      }),
      ... this.doBuildProductAndBom('红烧肉', ['猪肉'], {
        price: 2,
        stockBuyUnitFee: 2
      }),
      ... this.doBuildProductAndBom('东坡肉', ['猪肉'], {
        price: 0.5,
        stockBuyUnitFee: 1
      })
    ]
  }

  private doBuildProductAndBom(productName: string,
    materials: string[],
    price?: {
      price: number;
      stockBuyUnitFee: number;
    }

  ): BaseTest[] {
    if (price == null) {
      price = {
        stockBuyUnitFee: -10,
        price: 10
      }
    }
    let boms = []
    for (let material of materials) {
      boms.push({
        materialId: '${materialMap.' + material + '.materialId}',
        cnt: 10,
        buyUnitFee: 1,
        yieldRate: 0.8,
        netCnt: 8,
        ...price
      })
    }
    return [
      new Action({
        name: '增加餐品',
        url: '/app/product/addProduct',
        param: {
          name: productName
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
          boms
        }
      })
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

    ret.push(new BuildInventory({
      dayCnt: 7,
      nameArray: ['白菜'],
      defVal: 300
    }))
    ret.push(... this.buildNotes())

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
    ret.push(new BuildInventory({
      dayCnt: 6,
      nameArray: ['白菜'],
      defVal: 150
    }))
    ret.push(this.buildImportProduct())
    ret.push(new BuildInventory({
      dayCnt: 1,
      nameArray: ['猪肉'],
      defVal: 0


    }))
    ret.push(new Action({
      name: '全部计算',
      url: '/free/stateMaterial/recalStateMaterial',
      param: {
        warehouseId: '${warehouse.warehouseId}'

      }
    }))




    ret.push(new Action({
      name: 'analysyMaterial',
      url: '/app/state/analysyMaterial',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(7),
        end: StrDateUtil.beforeDay(1)
      },

    }, {
      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqualArray(
          content,
          [
            {
              "materialId": "33779",
              "cnt": {
                "buyUnitFee": 1,
                "cnt": 400,
                "stockUnitsId": 0
              },
              "theoryCnt": {
                "cnt": 300,
                "buyUnitFee": 1
              },
              "cost": 400,
              "theoryCost": 550,
              "hasBeginInventory": false,
              "hasEndInventory": true,
              "hasMidInventory": false,
              "productCnt": 3,
              "name": "猪肉",

            },
            {
              "cnt": {
                "buyUnitFee": 1,
                "cnt": 330,
                "stockUnitsId": 0
              },
              "theoryCnt": {
                "cnt": 100,
                "buyUnitFee": 1
              },
              "cost": 165,
              "theoryCost": 100,
              "hasBeginInventory": true,
              "hasEndInventory": false,
              "hasMidInventory": true,
            }
          ], {
          notCheckCols: ['materialId']
        }
        )
      }
    }))

    ret.push(
      new Action(
        {
          name: '测试接口：analysyProduct',
          url: '/app/state/analysyProduct',
          param: {
            warehouseId: '${warehouse.warehouseId}',
            begin: StrDateUtil.beforeDay(7),
            end: StrDateUtil.beforeDay(1)
          }
        },
        {
          check(result) {
            let content = result.result.content;
            CheckUtil.expectEqualArray(content, [
              {
                "productId": "1740",
                "cost": 298.34,
                "costOfBom": 200,
                "diff": 98.34,
                "name": "白菜猪肉",
                "scaleName": ""
              },
              {
                "productId": "1735",
                "cost": 133.33,
                "costOfBom": 400,
                "name": "红烧肉",
                "scaleName": ""
              },
              {
                "productId": "1736",
                "cost": 133.33,
                "costOfBom": 50,
                "name": "东坡肉",
                "scaleName": ""
              }
            ], {
              notCheckCols: ['productId']
            })
          }
        }
      )
    )

    ret.push(new Action({
      name: '测试：compareCost',
      url: '/app/state/compareCost',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(7),
        end: StrDateUtil.beforeDay(1)
      }

    }, {
      check(result) {
        result = result.result;
        CheckUtil.expectEqualArray(result.array, [
          {
            "type": "realCost",
            "theoryCost": 650,
            "cost": 565
          },
          {
            "type": "bomCost",
            "theoryCost": 650,
            "cost": 1063.32
          },
          {
            "type": "bomCost4RealCnt",
            "cost": 565,
            "theoryCost": 1063.32
          }
        ])
      }
    }))
    return ret;
  }

  private buildNotes() {
    let ret: BaseTest[] = []
    let pigOpt = {

      needInstock: true,
      cnt: 40,
      buyUnitFee: -10,
      price: 1,
      yieldRate: 0.8,
      names: ['猪肉'],
      stockBuyUnitFee: 1
    }

    let cabbageOpt = {
      needInstock: true,
      cnt: 40,
      buyUnitFee: -10,
      price: 0.5,
      yieldRate: 0.5,
      names: ['白菜'],
      stockBuyUnitFee: 1

    }

    ret.push(... this.buildNote(7, pigOpt))
    ret.push(... this.buildNote(7, cabbageOpt))
    return ret
  }

  private buildImportProduct(): Action {
    let days = []

    days.push(... this.buildDay(6, 2))
    days.push(... this.buildDay(5, 3))
    days.push(... this.buildDay(4, 5))

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
      },
      {
        product: {
          name: '东坡肉',
          id: '${product.东坡肉}'
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
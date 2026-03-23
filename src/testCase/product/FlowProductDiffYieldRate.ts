import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import BuildInventory from "../../action/case/BuildInventory";
import BatchProcessNote from "../../action/note/BatchProcessNote";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import BuildUpdateStock from "../../action/case/BuildUpdateStock";
import PreNote from "../PreNote";

export default class extends TestCase {
  beginMaterial: number;
  getName(): string {
    return '餐品模型[不同出成率]'
  }

  private buildProductAndBom(): BaseTest[] {
    return [

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
              "cnt": 10,
              "buyUnitFee": 1,
              "yieldRate": 0.5,
              "netCnt": 0.5,
              "stockBuyUnitFee": 1,
              "price": 1
            },


          ]
        }
      }),
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
              "yieldRate": 0.5,
              "netCnt": 0.5,
              "stockBuyUnitFee": 1,
              "price": 1.5
            },
            {
              "materialId": '${materialMap.白菜.materialId}',
              "cnt": 10,
              "buyUnitFee": 1,
              "yieldRate": 0.5,
              "netCnt": 0.5,
              "stockBuyUnitFee": 1,
              "price": 2
            }


          ]
        }
      }),

      new Action({
        name: '增加餐品',
        url: '/app/product/addProduct',
        param: {
          name: '煮鸡蛋'
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
              "materialId": '${materialMap.鸡蛋.materialId}',
              "cnt": 10,
              "buyUnitFee": 1,
              "yieldRate": 0.5,
              "netCnt": 0.5,
              "stockBuyUnitFee": 1,
              "price": 2.5
            },



          ]
        }
      }),
    ]
  }
  protected buildActions(): BaseTest[] {
    return [
      ... new PreTest().getActions(),
      ... this.buildProductAndBom(),

      ... new BuildInventory({
        dayCnt: 7,
        defVal: 150,
        defCost: 150,
        nameArray: ['猪肉', '白菜', '鸡蛋']
      }).getActions(),



      ... this.buildNote(6, {
        needInstock: true,
        cnt: 10,
        buyUnitFee: -10,
        price: 2,
        yieldRate: 0.8
      }),

      ... this.buildNote(6, {
        handInstock: true,
        cnt: 1,
        buyUnitFee: -100,
        price: 2,
        supplier: '供应商2',
        yieldRate: 0.7

      }),
      ... this.buildNote(6, {
        needStatement: true,
        cnt: 10,
        buyUnitFee: -10,
        price: 2.5,
        supplier: '供应商2',
        yieldRate: 0.6
      }),





      new Action({
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
      }),

      this.buildImportProduct(),
      new Action({
        name: '全部计算',
        url: '/free/stateMaterial/recalStateMaterial',
        param: {
          warehouseId: '${warehouse.warehouseId}'

        }
      }),
      ... this.buildCheckAction()




    ]
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
                  "begin": StrDateUtil.beforeDay(4),
                  "end": StrDateUtil.beforeDay(4),
                  "yieldRate": 0.8
                },
                {
                  "cnt": 100,
                  "cost": 200,
                  "buyUnitFee": 1,
                  "begin": StrDateUtil.beforeDay(4),
                  "end": StrDateUtil.beforeDay(2),
                  "yieldRate": 0.7
                },
                {
                  "cnt": 50,
                  "cost": 125,
                  "buyUnitFee": 1,
                  "begin": StrDateUtil.beforeDay(2),
                  "end": StrDateUtil.beforeDay(2),
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
    return new Action({
      name: '上传销售记录',
      url: '/app/salesRecord/importSalesRecord',
      param: {
        datas: [
          ... this.buildDay(-5, 15),
          ... this.buildDay(-4, 14),
          ... this.buildDay(-3, 5),
          ... this.buildDay(-2, 2),
          ... this.buildDay(-2, 4)
        ],
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
      },
      {
        product: {
          name: '煮鸡蛋',
          id: '${product.煮鸡蛋}'
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

  private buildBack(day: number) {
    let ret: BaseTest[] = [];
    ret.push(new Action({
      name: '创建退货单',
      url: '/app/noteBack/createNoteBack',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        items: '${note.noteItems}'
      }
    }))
    ret.push(
      ... new BuildUpdateStock({
        dayCnt: day,
        tables: ['stockRecord', 'note', 'noteItem']
      }).getActions()
    )
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
    yieldRate?: number
  }): BaseTest[] {
    return new PreNote({
      ...opt,
      day
    }).getActions();
  }

}
import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import PreNote from "../PreNote";
import BuildInventory from "../../action/case/BuildInventory";

export default class extends TestCase {

  private buildImportProduct(): Action {
    let days = []

    days.push(... this.buildDay(4, 2))
    days.push(... this.buildDay(3, 3))
    days.push(... this.buildDay(2, 5))

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
      },
      {
        product: {
          name: '炒鸡蛋',
          id: '${product.炒鸡蛋}'
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
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [
      new PreTest(),
      ... this.buildProductAndBom()
    ]
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
    ret.push(... this.buildNotes())
    ret.push(this.buildImportProduct())
    ret.push(new Action({
      name: '全部计算',
      url: '/free/stateMaterial/recalStateMaterial',
      param: {
        warehouseId: '${warehouse.warehouseId}'

      }
    }))

    ret.push(new Action({
      name: '查询状态特征值',
      url: '/app/state/stateEigenvalue',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(7),
        end: StrDateUtil.beforeDay(1)
      }
    }, {
      check(result) {
        result = result.result;
        CheckUtil.expectEqualObj(result, {
          "needInventoryMaterialCnt": 2,
          "noSalesRecordDays": 3,
          "salesProductCnt": 40,
          "salesProductBomCost": 350
        })
      }
    }))

    ret.push(new BuildInventory({
      dayCnt: 7,
      nameArray: ['白菜'],
      defVal: 350
    }))

    ret.push(new BuildInventory({
      dayCnt: 1,
      nameArray: ['猪肉'],
      defVal: 10
    }))
    ret.push(new Action({
      name: '全部计算',
      url: '/free/stateMaterial/recalStateMaterial',
      param: {
        warehouseId: '${warehouse.warehouseId}'

      }
    }))

    ret.push(new Action({
      name: '查询状态特征值',
      url: '/app/state/stateEigenvalue',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(7),
        end: StrDateUtil.beforeDay(1)
      }
    }, {
      check(result) {
        result = result.result;
        CheckUtil.expectEqualObj(result, {
          "needInventoryMaterialCnt": 1
        })
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
    return [
      new PreNote({
        ...opt,
        day
      })
    ];
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
      }),
      ... this.doBuildProductAndBom('炒鸡蛋', [], {
        price: 0.5,
        stockBuyUnitFee: 1
      })


    ]
  }

  getName(): string {
    return 'StateEigenvalue';
  }


}
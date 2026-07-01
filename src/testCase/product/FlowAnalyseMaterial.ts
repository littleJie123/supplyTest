import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import PreNote from "../PreNote";
import BuildInventory from "../../action/case/BuildInventory";
export default class extends TestCase {

  getName(): string {
    return 'analysyMaterial'
  }


  private buildProductAndBom() {
    return [

      ... this.doBuildProductAndBom('红烧肉', ['猪肉'], {
        price: 2,
        stockBuyUnitFee: 2
      }),



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
        price: 8
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
      new PreTest(),
      ... this.buildProductAndBom()
    ]


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





    ret.push(
      new Action(
        {
          name: 'analysyMaterial',
          url: '/app/state/analysyMaterial',
          param: {
            warehouseId: '${warehouse.warehouseId}',
            begin: StrDateUtil.beforeDay(7),
            end: StrDateUtil.beforeDay(1)
          }
        },
        {
          check(result) {
            let content = result.result.content;
            let row = content[0];
            CheckUtil.expectEqualObj(row, {
              "diff": 320,
              "diffByCnt": 380,
              "diffByPrice": -60
            })
          }
        }

      )
    )


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



    ret.push(... this.buildNote(7, pigOpt))
    return ret
  }

  private buildImportProduct(): Action {
    let days = []

    days.push(... this.buildDay(4, 2))


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
    return [
      new PreNote({
        ...opt,
        day
      })
    ];
  }

}
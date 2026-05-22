import { TestCase, BaseTest, ArrayUtil } from "testflow";
import Action from "../Action";

interface Item {
  productName: string;
  materials: string[];
  price: {
    price: number;
    stockBuyUnitFee: number;
  }
}

interface Opt {
  array?: Item[]
}

export default class extends TestCase {

  private theOpt: Opt;
  constructor(opt?: Opt) {

    super();
    this.theOpt = opt
  }


  protected getItemArray(): Item[] {
    return this.theOpt?.array ?? [
      {
        productName: '白菜猪肉',
        materials: ['猪肉', '白菜'],
        price: {
          price: 1,
          stockBuyUnitFee: 1
        }

      },
      {
        productName: '红烧肉',
        materials: ['猪肉'],
        price: {
          price: 1,
          stockBuyUnitFee: 1
        }

      }
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
      })
    ]
  }
  protected buildActions(): BaseTest[] {
    let retList: BaseTest[] = [];
    let items = this.getItemArray();
    for (let item of items) {
      retList.push(
        ...   this.doBuildProductAndBom(item.productName, item.materials, item.price)

      )
    }
    return retList
  }

  getName(): string {
    return '初始化bom和餐品'
  }

}
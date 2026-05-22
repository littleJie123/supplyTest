import { BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import Instock from "../../action/note/Instock";
import PreNote from "../PreNote";
import PreTest from "../PreTest";
import PreBom from "../../action/bom/PreBom";
import Action from "../../action/Action";
import BuildInventory from "../../action/case/BuildInventory";
export default class extends TestCase {
  beginMaterial: number;
  getName(): string {
    return 'statewarehouse'
  }





  /**
   * 
   * @returns 
   */
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [
      new PreTest()

    ]

    ret.push(new PreBom())


    ret.push(new PreNote({
      cnt: 100,
      price: 20,
      names: ['白菜', '猪肉'],
      day: 10
    }))


    ret.push(new PreNote({
      cnt: 400,
      price: 20,
      names: ['白菜', '猪肉'],
      needInstock: true,
      day: 10
    }))


    ret.push(new PreNote({
      cnt: 300,
      price: 20,
      names: ['羊肉', '猪肉', '牛肉'],
      needInstock: true,
      day: 8
    }))

    ret.push(this.buildImportProduct())


    ret.push(new BuildInventory({
      dayCnt: 1,
      nameArray: ['白菜', '猪肉'],
      defVal: 100
    }))

    ret.push(new Action({
      name: '全部计算',
      url: '/free/stateMaterial/recalStateMaterial',
      param: {
        warehouseId: '${warehouse.warehouseId}'

      }
    }))

    ret.push(new Action({
      name: '查看统计',
      url: '/app/state/stateWarehouse',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        "begin": StrDateUtil.beforeDay(10),
        "end": StrDateUtil.beforeDay(1),
      }
    }, {
      check(result) {
        let info = result.result.result;
        console.log('info',info);
        CheckUtil.expectEqualObj(info, {
          "openingAmount": 0,
          "instockAmount": 34000,
          "amount": 18000,
          "endAmount": 16000,
          "endAmountOfTheory": 28000,
          "salesAmount": 6000,
          "hasInventory": 2,
        })
      }
    }))

    return ret;
  }

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
      }
    ]
  }

  private getDate(day: number): number {
    let date = new Date();
    date = DateUtil.beforeDay(date, day);
    let ret = DateUtil.toExcelDateNum(date);

    return ret;
  }
}
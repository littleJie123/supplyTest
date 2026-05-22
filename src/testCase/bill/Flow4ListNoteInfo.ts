import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreBom from "../../action/bom/PreBom";
import PreNote from "../PreNote";
import PreTest from "../PreTest";
import Action from "../../action/Action";

export default class extends TestCase {
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

    ret.push(new Action({
      name: 'listNoteInfo',
      url: '/app/bill/listNoteInfo',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        result = result.result;
        CheckUtil.expectEqualObj(result, {
          "normal": {
            "status": "normal",
            "cost": 4000,
            "cnt": 1
          },
          "instocked": {
            "status": "instocked",
            "cost": 34000,
            "cnt": 2
          }
        })
      }
    }))
    return ret
  }
  getName(): string {
    return 'ListNoteInfo'
  }

}
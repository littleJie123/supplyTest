import { ArrayUtil, BaseTest, CheckUtil, DateUtil, HttpAction, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import BuildWarehouse from "../../action/case/BuildWarehouse";
import BuildNoteAndInstock from "../../action/case/BuildNoteAndInstock";
import BuildInventory from "../../action/case/BuildInventory";
import BuildBack from "../../action/case/BuildBack";
const S_Days = 30;
export default class extends TestCase {
  getName(): string {
    return '测试统计【statewarehouse】'
  }

  protected buildActions(): BaseTest[] {
    let end = DateUtil.beforeDay(new Date(), 1);
    let begin = DateUtil.beforeDay(new Date(), S_Days);
    return [
      new BuildWarehouse(),

      new BuildNoteAndInstock({
        dayCnt: 100,
        defPrice: 3
      }),

      new BuildNoteAndInstock({
        dayCnt: 10
      }),

      ... new BuildBack({
        dayCnt: 9,
        defVal: 1
      }).getActions(),

      new BuildNoteAndInstock({
        dayCnt: 8,
        defPrice: 2
      }),


      ... new BuildInventory({
        dayCnt: 5,
        defVal: 24
      }).getActions(),
      // new BuildNoteAndInstock({
      //   dayCnt: 5
      // }),

      // new BuildNoteAndInstock({
      //   dayCnt: 1
      // }),

      new Action({
        name: '统计',
        url: '/app/state/stateWarehouse',

        param: {
          warehouseId: '${warehouse.warehouseId}',
          opening: DateUtil.format(begin),
          end: DateUtil.format(end)
        }
      }, {
        check(result) {
          result = result.result.result;
          CheckUtil.expectEqualObj(result, {
            "openningAmount": 150,
            "endAmount": 210,
            "amount": 85,
            "instockAmount": 145,
          })
        },
      })
    ]
  }
}
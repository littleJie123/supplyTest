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
    return '测试统计【盘点】'
  }

  protected buildActions(): BaseTest[] {
    let end = DateUtil.beforeDay(new Date(), 1);
    let begin = DateUtil.beforeDay(new Date(), 5);
    let materialCnt = 1;
    return [
      new BuildWarehouse({
        materialCnt
      }),





      ... new BuildInventory({
        dayCnt: 100,
        defVal: 10,
        defCost: 10,
        materialCnt
      }).getActions(),

      new BuildNoteAndInstock({
        dayCnt: 4,
        defPrice: 3,
        materialCnt,
        defCnt: 5
      }),
      new BuildInventory({
        dayCnt: 1,
        defVal: 7,
        materialCnt
      }),



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
          // CheckUtil.expectEqualObj(result, {
          //   "openningAmount": 150,
          //   "endAmount": 210,
          //   "amount": 85,
          //   "instockAmount": 145,
          // })
        },
      })
    ]
  }
}
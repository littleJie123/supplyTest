import { BaseTest, DateUtil, TestCase } from "testflow";
import Action from "../Action";

interface Opt {
  dayCnt?: number;
}
export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [];
    let day = this.opt?.dayCnt ?? 0;


    if (day > 0) {
      let date = DateUtil.beforeDay(new Date(), day);
      let today = DateUtil.today();

      ret.push(new Action(
        {
          name: `更新第${day}天stockrecord数据`,
          param: {
            table: 'stockRecord',
            cdts: [
              {
                val: '${warehouse.warehouseId}',
                col: 'warehouseId'
              },
              {
                val: today.getTime(),
                col: 'bussinessDate',
                op: '>='
              }
            ],
            data: {
              sysAddTime: DateUtil.formatDate(date),
              bussinessDate: date.getTime()
            }
          },
          url: '/free/update'
        }
      ))

      ret.push(new Action(
        {
          name: `更新第${day}天inventory数据`,
          param: {
            table: 'inventory',
            cdts: [
              {
                val: '${warehouse.warehouseId}',
                col: 'warehouseId'
              },
              {
                val: DateUtil.todayStr(),
                col: 'inventoryDay',

              }
            ],
            data: {
              inventoryDay: DateUtil.format(date)
            }
          },
          url: '/free/update'
        }
      ))
    }


    return ret;
  }
  getName(): string {
    return '更新库存记录'
  }
  private opt: Opt;
  constructor(opt?: Opt) {

    super();
    this.opt = opt;
  }
}
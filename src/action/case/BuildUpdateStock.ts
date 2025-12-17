import { BaseTest, DateUtil, TestCase } from "testflow";
import Action from "../Action";

interface Opt {
  dayCnt?: number;
  tables?: string[]
}
export default class extends TestCase {
  private opt: Opt;
  constructor(opt?: Opt) {

    super();
    this.opt = opt;
  }
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [];
    let tables: string[] = this.opt?.tables ?? ['stock', 'stockRecord', 'note', 'noteItem', 'inventory'];
    let day = this.opt?.dayCnt ?? 0;


    if (day > 0) {
      let date = DateUtil.beforeDay(new Date(), day);
      for (let table of tables) {
        let data: any = {
          sysAddTime: DateUtil.formatDate(date)
        }
        if (table.toLowerCase() == 'stockrecord') {
          data.bussinessDate = date.getTime();
        }
        if (table.toLocaleLowerCase() == 'inventory') {
          data.inventoryDay = DateUtil.format(date);
        }
        ret.push(new Action(
          {
            name: `更新第${day}天${table}数据`,
            param: {
              table: table,
              cdts: [
                {
                  val: '${warehouse.warehouseId}',
                  col: 'warehouseId'
                },
                {
                  val: DateUtil.todayStr(),
                  col: 'sysAddTime',
                  op: '>='
                }
              ],
              data: data
            },
            url: '/free/update'
          }
        ))
      }

    }
    return ret;
  }
  getName(): string {
    return '更新数据'
  }

}
import { BaseTest, CheckUtil, TestCase } from "testflow";
import Action from "../../action/Action";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";

const REPEAT_NAME = '重复土豆';

/**
 * /app/material/checkRepeat
 * 同名物料 cnt>1 会查出。lastTime 会带上 having max(sysAddTime)，走 NoteSafeCdt。
 */
export default class extends TestCase {
  constructor() {
    super({
      remark: 'checkRepeat：同名物料可查出；lastTime 不因 max(sysAddTime) 报字段不合法'
    })
  }

  getName(): string {
    return '检查重复物料'
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),
      new Action({
        name: '插入同名物料',
        remark: '业务接口不允许同名，测试数据走 /free/add',
        url: '/free/add',
        param: {
          table: 'material',
          array: [
            materialRow(REPEAT_NAME, 'RPT001'),
            materialRow(REPEAT_NAME, 'RPT002'),
            materialRow('唯一白菜', 'RPT003')
          ]
        }
      }),

      new Action({
        name: '查出同名物料',
        remark: '不传 lastTime，having cnt>1',
        url: '/app/material/checkRepeat',
        param: {
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          assertRepeat(result, '不传 lastTime');
        }
      }),

      new Action({
        name: 'lastTime仍查出同名物料',
        remark: 'lastTime 使用 NoteSafeCdt(max(sysAddTime))，刚创建的同名物料应仍在结果里',
        url: '/app/material/checkRepeat',
        param: {
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          lastTime: 1
        }
      }, {
        check(result) {
          assertRepeat(result, 'lastTime');
        }
      })
    ]
  }
}

function materialRow(name: string, code: string) {
  return {
    name,
    code,
    isDel: 0,
    stockUnitsId: 18,
    unitsId: 18,
    buyUnitsId: 132,
    warehouseGroupId: '${warehouse.warehouseGroupId}'
  };
}

function assertRepeat(result: any, label: string) {
  const content = result?.result?.content ?? [];
  const row = content.find((item: any) => item.name == REPEAT_NAME);
  CheckUtil.expectEqual(row != null, true, `${label} 应查出${REPEAT_NAME}，实际=${JSON.stringify(content)}`);
  CheckUtil.expectEqual(Number(row.cnt) > 1, true, `${label} ${REPEAT_NAME} 的 cnt 应大于 1，实际=${row.cnt}`);
  const only = content.find((item: any) => item.name == '唯一白菜');
  CheckUtil.expectEqual(only == null, true, `${label} 不应查出唯一白菜，实际=${JSON.stringify(content)}`);
}

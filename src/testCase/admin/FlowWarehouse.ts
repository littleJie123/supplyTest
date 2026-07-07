import { BaseTest, TestCase } from "testflow";
import LoginAdmin from "../../action/adminUser/LoginAdmin";
import AdminQueryAction from "../../action/adminUser/AdminQueryAction";

function verifyWarehouseInfo(content: any[]) {
  if (content.length === 0) {
    throw new Error('门店列表为空，需要已有门店数据');
  }
  for (let row of content) {
    if (row.warehouseId == null) {
      throw new Error('门店缺少 warehouseId');
    }
    if (row.name == null) {
      throw new Error('门店缺少 name');
    }
    if (row.type == null) {
      throw new Error('门店缺少 type');
    }
    if (row.noteCnt == null) {
      throw new Error('门店缺少 noteCnt');
    }
    if (row.billCnt == null) {
      throw new Error('门店缺少 billCnt');
    }
    if (row.usersCnt == null) {
      throw new Error('门店缺少 usersCnt');
    }
  }
}

function pickWarehouseIds(content: any[]) {
  let noteWarehouse = content.find(row => row.noteCnt > 0);
  let billWarehouse = content.find(row => row.billCnt > 0);
  let usersWarehouse = content.find(row => row.usersCnt > 0);
  if (noteWarehouse == null) {
    throw new Error('未找到订单数量不为空的门店');
  }
  if (billWarehouse == null) {
    throw new Error('未找到对账单数量不为空的门店');
  }
  if (usersWarehouse == null) {
    throw new Error('未找到用户数量不为空的门店');
  }
  return {
    noteWarehouseId: noteWarehouse.warehouseId,
    billWarehouseId: billWarehouse.warehouseId,
    usersWarehouseId: usersWarehouse.warehouseId,
  };
}

function verifyNoteList(content: any[]) {
  for (let row of content) {
    if (row.title == null) {
      throw new Error('订单缺少 title');
    }
    if (row.status == null) {
      throw new Error('订单缺少 status');
    }
  }
}

function verifyBillList(content: any[]) {
  for (let row of content) {
    if (row.title == null) {
      throw new Error('对账单缺少 title');
    }
    if (row.status == null) {
      throw new Error('对账单缺少 status');
    }
  }
}

function verifyUsersList(content: any[]) {
  for (let row of content) {
    if (row.usersId == null) {
      throw new Error('用户缺少 usersId');
    }
    if (row.useDays == null) {
      throw new Error('用户缺少 useDays');
    }
  }
}

export default class extends TestCase {
  getName(): string {
    return '运营平台查询门店';
  }

  protected buildActions(): BaseTest[] {
    let variable = this.getVariable();
    variable.token = '';
    return [
      new LoginAdmin(),
      new AdminQueryAction({
        name: '查询门店账号信息',
        url: '/admin/warehouse/listWarehouseInfo',
        query: {},
        verify: verifyWarehouseInfo,
      }, {
        buildVariable(result) {
          return pickWarehouseIds(result.result.content);
        }
      }),
      new AdminQueryAction({
        name: '查询门店订单',
        url: '/admin/note/listNote',
        query: {
          warehouseId: '${noteWarehouseId}',
        },
        verify: verifyNoteList,
      }),
      new AdminQueryAction({
        name: '查询门店对账单',
        url: '/admin/bill/listBill',
        query: {
          warehouseId: '${billWarehouseId}',
        },
        verify: verifyBillList,
      }),
      new AdminQueryAction({
        name: '查询门店用户',
        url: '/admin/users/listUsers',
        query: {
          warehouseId: '${usersWarehouseId}',
        },
        verify: verifyUsersList,
      }),
    ];
  }
}

import { BaseTest, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import AddSupplier from "../../action/supplier/AddSupplier";

export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new AddSupplier('北京滇美云祥商贸有限公司'),
      new AddSupplier('丹东企鹅叮咚商贸有限公司')
    ]
  }

  getName(): string {
    return '上传单据'
  }
}
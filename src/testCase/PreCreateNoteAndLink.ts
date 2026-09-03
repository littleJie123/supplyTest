import { ArrayUtil, BaseTest, TestCase } from "testflow";
import Action from "../action/Action";
import ListMaterial from "../action/material/ListMaterial";
import CreateNote3M from "../action/note/CreateNote3M";
import QueryAction from "../action/QueryAction";
import SaveShareData from "../action/shareData/SaveShareData";
import ChangeWarehouse2Supplier from "../action/user/ChangeWarehouse2Supplier";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import AddSupplier from "../action/supplier/AddSupplier";
import AddMaterial from "../action/material/AddMaterial";
interface Opt {
  supplierName?: string
}
/**
 * warehouseType = supplierWarehouse 为供应商
 * 构建出订单和供应商 并且关联
 */
export default class extends TestCase {
  private opt: Opt;
  constructor(opt?: Opt) {
    super({ remark: '下单发送后分享，供应商仓接单建立关联' });
    this.opt = opt
  }
  getSupplierName() {
    return this.opt?.supplierName ?? '供应商1'
  }

  needInScreen(): boolean {
    return false;
  }
  protected buildActions(): BaseTest[] {
    return [
      new ListMaterial().setRemark('刷新餐厅物料 map'),

      new CreateNote3M().setRemark('下单3物料并发送'),


      new AddWarehouse({
        name: '新供应商',
        variableType: 'supplierWarehouse',
        type: 'supplier'

      }).setRemark('创建供应商仓'),
      new AddMaterial('羊肉', {
        type: 'supplierWarehouse',
        buyUnit: [
          { "name": "克", "fee": 1 },
          { "isSupplier": true, "name": "瓶", "fee": 500 }
        ],
        suppliers: []
      }).setRemark('供应商仓增加羊肉物料'),
      new QueryAction({
        name: '查询订单',
        url: '/app/note/listNote',
        query: {
          status: 'normal'
        }
      }, {
        buildVariable(result) {
          return {
            noteMap: ArrayUtil.toMapByKey(result.result.content, 'supplierName', 'noteId')
          }
        }
      }).setRemark('按供应商名记下 noteId，供分享'),
      new SaveShareData({
        data: {
          noteId: `\${noteMap.${this.getSupplierName()}}`
        }
      }).setRemark('保存分享数据，记下 shareDataNo'),
      new Action({
        url: '/share/shareNote',
        name: '查询分享单',
        remark: '按 shareDataNo 拉分享单',
        param: {
          "shareDataNo": "${shareDataNo}",
          "usersId": "${usersId}",
        }
      }),
      new ChangeWarehouse2Supplier().setRemark('切换到供应商仓'),
      new Action({
        url: '/app/note/linkNote',
        name: '接单',
        remark: '供应商接单 /app/note/linkNote，写入 Supplier_Link 历史',
        param: {
          warehouseId: "${supplierWarehouse.warehouseId}",
          _shareDataNo: "${shareDataNo}",
        }

      }, {
        warehouseType: 'supplierWarehouse'
      })

    ]
  }
  getName(): string {
    return '发单&供应商接单';
  }

}
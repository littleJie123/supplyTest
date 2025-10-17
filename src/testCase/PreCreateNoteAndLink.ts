import { ArrayUtil, BaseTest, TestCase } from "testflow";
import Action from "../action/Action";
import ListMaterial from "../action/material/ListMaterial";
import CreateNote3M from "../action/note/CreateNote3M";
import QueryAction from "../action/QueryAction";
import SaveShareData from "../action/shareData/SaveShareData";
import ChangeWarehouse from "../action/user/ChangeWarehouse";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import AddSupplier from "../action/supplier/AddSupplier";
import AddMaterial from "../action/material/AddMaterial";
interface Opt{
  supplierName?:string
}
/**
 * warehouseType = supplierWarehouse 为供应商
 * 构建出订单和供应商 并且关联
 */
export default class extends TestCase {
  private opt:Opt;
  constructor(opt?:Opt){
    super();
    this.opt = opt
  }
  getSupplierName(){
    return this.opt?.supplierName ?? '供应商1'
  }

  needInScreen(): boolean {
    return false;
  }
  protected buildActions(): BaseTest[] {
    return [
      new ListMaterial(),

      new CreateNote3M(),

      
      new AddWarehouse({
        name: '新供应商',
        variableType: 'supplierWarehouse',
        type: 'supplier'

      }),
      new AddMaterial('羊肉',{
        type:'supplierWarehouse',
        buyUnit:[
          {  "name": "克", "fee": 1 },
          { "isSupplier": true, "name": "瓶", "fee": 500 }
        ],
        suppliers:[]
      }),
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
      }),
      new SaveShareData({
        data: {
          noteId: `\${noteMap.${this.getSupplierName()}}`
        }
      }),
      new Action({
        url: '/share/shareNote',
        name: '查询分享单',
        param: {
          "shareDataNo": "${shareDataNo}",
          "usersId": "${usersId}",
        }
      }),
      new ChangeWarehouse(),
      new Action({
        url: '/share/linkNote',
        name: '接单',
        param: {
          warehouseId: "${supplierWarehouse.warehouseId}",
          shareDataNo: "${shareDataNo}",
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
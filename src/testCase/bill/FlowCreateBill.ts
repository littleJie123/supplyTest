import { BaseTest, CheckUtil, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import AddSupplier from "../../action/supplier/AddSupplier";
import Upload from "../../action/Upload";
import path from "path";
import Action from "../../action/Action";
import Recal from "../../action/Recal";
import CheckCnt from "../../action/CheckCnt";

export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    let ret = this.buildYunxia()
    let variable = this.getVariable();
    ret.push(new CheckCnt([
      {
        table:'note',
        query:{
          status:'instocked'
        },
        cntFun(cnt:number){
          CheckUtil.expectEqual(cnt>0,true)
        }
      }
    ]))

    ret.push(new Action({
      name:'查询供应商（订单信息）',
      url:'/app/supplier/listSupplier4Bill',
      param:{
        warehouseId:'${warehouse.warehouseId}'
      }
    },{
      buildVariable(result){
        return {
          suppliers:result.result.content,
          supplier:result.result.content[0]
        }
      }
    }))

    ret.push(new Action({
      name:'按供应商确认',
      url:'/app/bill/createBillBySupplier',
      param:{
        warehouseId:'${warehouse.warehouseId}',
        supplierId:'${supplier.supplierId}'
      }
    }))

    ret.push(new Action({
      name:'查询bill',
      url:'/app/bill/listBill',
      param:{
        warehouseId:'${warehouse.warehouseId}'        
      }
    },{
      check(result){
        let supplier = variable.supplier;
        let bill = result.result.content[0]
        CheckUtil.expectEqualObj(bill,{
          noteCnt:supplier.cnt,
          supplierId:supplier.supplierId,
          instockCost:supplier.cost
        })
      }
    }))

    

    ret.push(new Action({
      name:'全部确认',
      url:'/app/bill/createBill4AllNote',
      param:{
        warehouseId:'${warehouse.warehouseId}',
        supplierId:'${supplier.supplierId}'
      }
    }))

    ret.push(new CheckCnt([
      {
        table:'note',
        query:{
          status:'instocked'
        },
        cnt:0
      }
    ]))

    ret.push(new CheckCnt([
      {
        table:'note',
        query:{
          status:'statement'
        },
        cntFun(cnt) {
          CheckUtil.expectEqual(cnt>0,true) 
        }
      }
    ]))


    return ret;
  }
  
  buildYunxia():BaseTest[]{
    let ret: BaseTest[] = [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),
      new AddSupplier('北京滇美云祥商贸有限公司'),
      new AddSupplier('丹东企鹅叮咚商贸有限公司'),
      new AddSupplier('北京昀衡商贸'),
      ... this.buildUpload('云下/云下物料', 'material'),

      ... this.buildUpload('云下/订单', 'purcharse'), 
     
    ]
    return ret;
  }
  buildUpload(url: string, target: String, opt?: {
    needSave: boolean
  }): BaseTest[] {
  
    let ret: BaseTest[] = [new Upload({
      name: '上传' + target,
      param: {
        target: target,
        warehouseId: '${warehouse.warehouseId}',
      },
      filePath: this.getFile(url),

    }, {
      check(result) {
        if(!opt?.needSave){
          result = result.result.importResult;
          CheckUtil.expectEqual(result.checked, true)
        }
      },
      buildVariable(result) {
        result = result.result;
        let fileCols = result.fileCols;
        fileCols = fileCols.filter(row => row.targetCol != null);
        fileCols = fileCols.map(row => ({ targetCol: row.targetCol, excelFileId: row.excelFileId }))
        return {
          excelFileId: result.excelFileId,
          fileCols
        }
      }
    })
    ]
    if (opt?.needSave) {
      ret.push(
        new Action({
          name: 'saveExcel',
          url: '/app/excel/saveExcel',
          param: {
            excelFileId: '${excelFileId}',
            fileCols: '${fileCols}',
            warehouseId: '${warehouse.warehouseId}'
          }
        })
      )
    }
    return ret;
  }
  getName(): string {
    return '一键对账'
  }
  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    let dir = path.join(__dirname, '../../../excel/', strPath)
    return dir;
  }
}
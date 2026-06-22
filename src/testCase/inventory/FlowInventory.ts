import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import PreNote from "../PreNote";
import BuildInventory from "../../action/case/BuildInventory";
import Recal from "../../action/Recal";
import CheckArray from "../../action/CheckArray";
import CheckCnt from "../../action/CheckCnt";
import { table } from "console";
export default class extends TestCase {

  getName(): string {
    return '指定盘点日期'
  }

  protected buildActions(): BaseTest[] {
    let variable = this.getVariable()
    let ret: BaseTest[] = [
      new PreTest()

    ]

    ret.push(this.buildInventory('牛肉'))
    ret.push(this.buildInventory('猪肉',20))
    ret.push(this.buildInventory('羊肉',30))
    ret.push(
      new Action({
        name:'保存盘点[指定日期]',
        url:'app/inventory/setInventoryFromInfo',
        param:{
          warehouseId:'${warehouse.warehouseId}',
          materialIds:[
            "${materialMap.羊肉.materialId}",
            "${materialMap.猪肉.materialId}"
          ],
          inventoryDay:'2026-05-01'
        }
      })
    )
    ret.push(new Recal())
    ret.push(new CheckArray([
      {
        table:'stockRecord',
        check(array:any[]){
          CheckUtil.expectEqualArray(array,[
            {materialId:variable.materialMap.羊肉.materialId,cnt:30},
            {materialId:variable.materialMap.猪肉.materialId,cnt:20}
          ])
          for(let row of array){
            let date = DateUtil.formatDate(new Date(row.bussinessDate));
            CheckUtil.expectEqual(date,'2026-05-01 21:00:00')
          }
        }
      }
    ]))
    ret.push(new CheckCnt([
        {
          table: 'stock',
          cnt:2
        }
      ]))
    return ret
  }

  private buildInventory(name:string,cnt?:number) {
    return new Action({
      url:'/app/stallMaterialInfo/setInventoryToInfo',
      name: '盘点：'+name,
      param: {
        "warehouseId": "${warehouse.warehouseId}",
        "stock": {
          "cnt": cnt ?? 10,
          "buyUnitFee": 1,
          "materialId": "${materialMap."+name+".materialId}"
        }
      }
    })
  }
}
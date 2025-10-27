import { BaseTest, DateUtil, TestCase } from "testflow";
import PreTest from "./PreTest";
import Action from "../action/Action";
import CreateNote3M from "../action/note/CreateNote3M";
import BatchProcessNote from "../action/note/BatchProcessNote";
import ListNoteGroup from "../action/note/ListNoteGroup";
const S_Days = 5
export default class extends TestCase{
  protected buildActions(): BaseTest[] {
    let ret:BaseTest[] = [new PreTest()];

    for(let i=0;i<1+S_Days;i++){
      ret.push(... this.buildDay(i))
    }
    ret.push(this.buildState())
    return ret;
  }
  getName(): string {
    return '统计'
  }

  buildState(){
    let date = DateUtil.beforeDay(new Date(),S_Days)
    return new Action({
      url:'/app/state/stateWarehouse',
      name:'正式统计',
      param:{
        warehouseId:'${warehouse.warehouseId}',
        opening:DateUtil.format(date),
        end:DateUtil.todayStr()
      }
    })
  }

  buildDay(index:number):BaseTest[]{
     
    let ret:BaseTest[] = [
      new CreateNote3M(),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal',
      
        noteCnt: 2
      }),
      new BatchProcessNote({
        action: 'instock'
      })

    ]
    if(index >0 && index % 5==0){
      ret.push(new Action({
        name:'盘点猪肉',
        url:'/app/inventory/setInventory',
        param:{
          "stock":{"cnt":5,"buyUnitFee":1,"stockUnitsId":18},
          "materialId":'${materialMap.猪肉.materialId}',
          "warehouseId":'${warehouse.warehouseId}'
        }
      }))

      ret.push(new Action({
        name:'盘点牛肉',
        url:'/app/inventory/setInventory',
        param:{
          "stock":{cnt: 2, buyUnitFee: 1, stockUnitsId: 18},
          "materialId":'${materialMap.牛肉.materialId}',
          "warehouseId":'${warehouse.warehouseId}'
        }
      }))

      ret.push(new Action({
        name:'盘点羊肉',
        url:'/app/inventory/setInventory',
        param:{
          "stock":{cnt: 10, buyUnitFee: 500, stockUnitsId: 29},
          "materialId":'${materialMap.羊肉.materialId}',
          "warehouseId":'${warehouse.warehouseId}'
        }
      }))
    }
    ret.push(
      ... this.buildUpdate(index)
    )
    return ret;
  }

  buildUpdate(index:number){
    let ret:any[] = []
    let date = DateUtil.beforeDay(new Date(),index);

    if(index>0){
      ret.push(new Action(
        {
          name:`更新第${index}天stockrecord数据`,
          param:{
            table:'stockRecord',
            cdts:[
              {
                val:'${warehouse.warehouseId}',
                col:'warehouseId'
              },
              {
                val:DateUtil.todayStr(),
                col:'sysAddTime',
                op:'>='
              }
            ],
            data:{
              sysAddTime:DateUtil.formatDate(date)
            }
          },
          url:'/free/update'
        }
      ))

      ret.push(new Action(
        {
          name:`更新第${index}天订单数据`,
          param:{
            table:'note',
            cdts:[
              {
                val:'${warehouse.warehouseId}',
                col:'warehouseId'
              },
              {
                val:DateUtil.todayStr(),
                col:'sysAddTime',
                op:'>='
              }
            ],
            data:{
              sysAddTime:DateUtil.formatDate(date)
            }
          },
          url:'/free/update'
        }
      ))
    }
    return ret;
  }

}
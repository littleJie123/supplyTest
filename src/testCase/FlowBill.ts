import { ArrayUtil, BaseTest, DateUtil, TestCase } from "testflow";
import FindLastUserId from "../action/user/FindLastUserId";
import AddSupplier from "../action/supplier/AddSupplier";
import ListSupplier from "../action/supplier/ListSupplier";
import GetOpenId from "../action/user/GetOpenId";
import AddWarehouse from "../action/warehouse/AddWarehouse"; 
import Action from "../action/Action";
import BatchProcessNote from "../action/note/BatchProcessNote";
import ListNoteGroup from "../action/note/ListNoteGroup"; 
import { WarehouseType } from "../inf/IOpt";

const S_MaterialCnt = 20;

const S_NoteCnt = 5;
const S_DayCnt = 10
interface BuilderOpt{
  warehouseType?:WarehouseType;
  supplierName?:string;
  noteStatus?:string
}

/**
 * 产生一个90天的订单数据
 */
export default class extends TestCase {
  private beginMaterial = 0;
  protected buildActions(): BaseTest[] {
    let supplierOpt:BuilderOpt = {
      warehouseType:'supplierWarehouse',
      supplierName:'餐厅1',
      noteStatus:'accept'
    }
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new AddSupplier('供应商1'),
      new AddSupplier('供应商2'),
      new ListSupplier(),

      ... this.buildMaterial(),
      ... this.buildDays(),
      ... this.createBills(),
      new AddWarehouse({
        name: '新供应商',
        variableType: 'supplierWarehouse',
        type: 'supplier'

      }),
      new AddSupplier(supplierOpt.supplierName,{type:'store',warehouseType:'supplierWarehouse'}),
      new ListSupplier({warehouseType:'supplierWarehouse'}),
      
      ... this.buildMaterial(supplierOpt),
      ... this.buildDays(supplierOpt),
      ... this.createBills(supplierOpt)
    ]
  }
  getName(): string {
    return "对账单造数据"
  }


  createBills(opt?:BuilderOpt):BaseTest[]{
    return [
      new Action({
        name:'查询订单',
        url:'/app/note/listNote',
        param:{
          warehouseId:this.getWarehouseType(opt)
        }
      },{
        buildVariable(result){
          let content = result.result.content;
          return {
            noteIds:content.map(row=>row.noteId)
          }
        },
        warehouseType:opt?.warehouseType
      }),
      new Action({
        name:'创建对账单',
        url:'/app/bill/createBill',
        param:{
          noteIds:'${noteIds}',
          warehouseId:this.getWarehouseType(opt),
          
        }
      },{
        warehouseType:opt?.warehouseType
      })
    ]
  }
  private getWarehouseType(opt:BuilderOpt,isGroupId?:boolean):string{
    let warehouse = opt?.warehouseType ?? 'warehouse';
    if(isGroupId){
      return `\${${warehouse}.warehouseGroupId}`
    }else{
      return `\${${warehouse}.warehouseId}` 
    }

  }

  private buildMaterial(opt?:BuilderOpt): BaseTest[] {
    let ret: BaseTest[] = []
    let materials:any[] = []
    for (let i = 0; i < S_MaterialCnt; i++) {
      materials.push({
        name:this.buildName(i),
        stockUnitsId:18,
        unitsId:18,
        buyUnitsId:132,
        warehouseGroupId:this.getWarehouseType(opt,true)
      })
    }
    ret.push(new Action({
      name:'批量增加物料',
      param:{
        array:materials,
        table:'material'
      },
      url:'/free/add'
    },{
      buildVariable(result){
        return {
          materialMap:ArrayUtil.toMapByKey(result.result,'name')
        }
      }
    }))
    return ret;
  }

  private buildDays(opt?:BuilderOpt): BaseTest[] {
    let ret: BaseTest[] = []
    for (let i = S_DayCnt - 1; i >= 0; i--) {
      ret.push(
        ... this.buildDay(i,opt)
      )
    }
    return ret;
  }

  private buildDay(day: number,opt?:BuilderOpt): BaseTest[] {
    let ret: BaseTest[] = []
    if (day % 30 == 0 && day != S_NoteCnt) {
      ret.push(... this.buildInventory(day,opt));
    } else if (day % 15 == 0) {
      ret.push(... this.buildBack(day,opt));
    } else {
      ret.push(... this.buildNote(day,opt))
    }
    ret.push(... this.buildUpdateStock(day,opt))
    return ret;
  }

  private buildNote(day: number,opt:BuilderOpt): BaseTest[] {
    let price = 5;
    if (day % 10 == 0) {
      price = 0;
    }
    let ret: BaseTest[] = [];
    let items: any[] = [];
    for (let i = 0; i < S_NoteCnt; i++) {
      let name = this.buildName(this.beginMaterial + i)
      items.push({
        "materialId": `\${materialMap.${name}.materialId}`,
        "supplierId": `\${supplierMap.${opt?.supplierName ?? '供应商1'}}`,
        "cnt": 30,
        "buyUnitFee": 1,
        "stockUnitsId": 0,
        "price": price,
        "stockBuyUnitFee": 1
      })
    }
    this.beginMaterial += S_NoteCnt;
    ret.push(new Action({
      name: `下单${S_NoteCnt}个物料`,
      url: '/app/note/createNote',
      method: 'post',
      param: {
        items,
        "warehouseId": this.getWarehouseType(opt),
        "warehouseGroupId": this.getWarehouseType(opt,true)
      }
    }, {
      buildVariable(result: any) {
        let ret: any = {}
        let content: any[] = result.result;
        ret.noteIds = ArrayUtil.toArray(content, 'noteId')
        return ret;
      }
    }))
    ret.push(new Action({
      url: '/app/note/sendNote',
      name:'发送订单',
      param: {
        noteIds: '${noteIds}',
        status: opt?.noteStatus ?? 'normal'
      }
    },{
      warehouseType:opt?.warehouseType
    }));
    ret.push(new ListNoteGroup({
      groupType: 'NoteDay',
      status: opt?.noteStatus ?? 'normal',

    },{
      warehouseType:opt?.warehouseType
    }));
    if(opt?.warehouseType == 'supplierWarehouse'){
      ret.push(new BatchProcessNote({
        action: 'send'
      },{
        warehouseType:opt?.warehouseType
      }));

      ret.push(new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'sended',

      },{
        warehouseType:opt?.warehouseType
      }));
    }
    ret.push(new BatchProcessNote({
      action: 'instock'
    },{
      warehouseType:opt?.warehouseType
    }));
    ret.push(new ListNoteGroup({
      groupType: 'NoteDay',
      status: 'instocked',

    },{
      warehouseType:opt?.warehouseType
    }))

    ret.push(new BatchProcessNote({
      action: 'statement'
    },{
      warehouseType:opt?.warehouseType
    }));
    return ret;
  }

  private buildName(index: number): string {
    index = index % S_MaterialCnt;
    return '物料' + index;
  }
  private buildInventory(day: number,opt?:BuilderOpt): BaseTest[] {
    let ret: BaseTest[] = [];
    let array:any = []
    for (let i = 0; i < S_MaterialCnt; i++) {
      let name = this.buildName(i);
      array.push({
        materialId:`\${materialMap.${name}.materialId}`,
        buyUnitFee:1,
        cnt:5
      })
    }
    ret.push(new Action({
      url:'/free/stock',
      name:'盘点',
      param:{
        action:'set',
        array,
        param:{
          warehouseId:this.getWarehouseType(opt),
          warehouseGroupId:this.getWarehouseType(opt,true)
        }
      }
    }))
    return ret;
  }

  private buildBack(day:number,opt:BuilderOpt): BaseTest[] {
    return [];
  }

  private buildUpdateStock(day: number,opt:BuilderOpt): BaseTest[] {
    let ret: BaseTest[] = [];
    let tables: string[] = ['stock', 'stockRecord', 'note', 'noteItem'];

    let date = DateUtil.beforeDay(new Date(), day);

    if (day > 0) {
      for (let table of tables) {
        ret.push(new Action(
          {
            name: `更新第${day}天${table}数据`,
            param: {
              table: table,
              cdts: [
                {
                  val: this.getWarehouseType(opt),
                  col: 'warehouseId'
                },
                {
                  val: DateUtil.todayStr(),
                  col: 'sysAddTime',
                  op: '>='
                }
              ],
              data: {
                sysAddTime: DateUtil.formatDate(date)
              }
            },
            url: '/free/update'
          }
        ))
      }

    }
    return ret;
  }
}
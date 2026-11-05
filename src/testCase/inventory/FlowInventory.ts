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
            CheckUtil.expectEqual(date,'2026-05-01 23:59:59')
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

    let today = DateUtil.todayStr()
    ret.push(new Action({
      name: '4月1日入库牛肉',
      remark: 'createHandInstock：10瓶/1000元，先形成批次。后面盘成2瓶时 afterStocks 按100元/瓶回填成200，盘点单金额另记999',
      url: '/app/note/createHandInstock',
      method: 'POST',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        salesDay: '2026-04-01',
        items: [{
          materialId: '${materialMap.牛肉.materialId}',
          supplierId: '${supplierMap.供应商1}',
          cnt: 10,
          buyUnitFee: 1,
          cost: 1000,
          price: 100,
          stockBuyUnitFee: 1
        }]
      }
    }))
    ret.push(new Recal().setRemark('入库入账后再盘点'))
    ret.push(new Action({
      name: '4月10日盘点牛肉和鸡蛋',
      remark: '牛肉 cnt=2、cost=999（盘点单金额）；鸡蛋无批次 cnt=1、cost=8',
      url: '/app/inventory/setInventoryByArray',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        bussinessDate: '2026-04-10',
        array: [{
          materialId: '${materialMap.牛肉.materialId}',
          cnt: 2,
          buyUnitFee: 1,
          cost: 999
        }, {
          materialId: '${materialMap.鸡蛋.materialId}',
          cnt: 1,
          buyUnitFee: 1,
          cost: 8
        }]
      }
    }))
    ret.push(new Action({
      name: '4月20日盘点羊肉和白菜',
      remark: '两笔都没有更早的批次，afterStocks 金额等于盘点单金额：羊肉50、白菜12',
      url: '/app/inventory/setInventoryByArray',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        bussinessDate: '2026-04-20',
        array: [{
          materialId: '${materialMap.羊肉.materialId}',
          cnt: 5,
          buyUnitFee: 1,
          cost: 50
        }, {
          materialId: '${materialMap.白菜.materialId}',
          cnt: 3,
          buyUnitFee: 1,
          cost: 12
        }]
      }
    }))
    ret.push(new Action({
      name: '当天加入未完成盘点',
      remark: 'addInventory 鸡蛋+白菜，只产生盘点行，不写盘点流水',
      url: '/app/inventory/addInventory',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        materialIds: [
          '${materialMap.鸡蛋.materialId}',
          '${materialMap.白菜.materialId}'
        ]
      }
    }))
    ret.push(new Action({
      name: '当天盘点改为未完成',
      remark: 'status=init，listInventoryDay 会列出这一天，但没有 Inventory 流水',
      url: '/free/update',
      param: {
        table: 'inventory',
        whereCdt: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          inventoryDay: today,
          isDel: 0
        },
        data: {
          status: 'init'
        }
      }
    }))
    ret.push(new Recal().setRemark('盘点入账后重算 afterStocks'))
    ret.push(new Action({
      name: '读取盘点流水和盘点单金额',
      remark: '按物料留最后一条，用 afterStocks 批次金额合计得到每日期望 cost',
      url: '/free/query',
      param: {
        array: [{
          table: 'stockRecord',
          query: {
            warehouseId: '${warehouse.warehouseId}',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            isDel: 0,
            type: 'Inventory'
          }
        }, {
          table: 'inventory',
          query: {
            warehouseId: '${warehouse.warehouseId}',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            isDel: 0
          }
        }]
      }
    }, {
      check(result) {
        let records = result?.result?.stockRecord ?? []
        let inventories = result?.result?.inventory ?? []
        let costByDay = sumInventoryDayCost(records)
        variable.inventoryDayCost = costByDay
        let beefId = variable.materialMap.牛肉.materialId
        let beefInv = inventories.find((row: any) =>
          String(row.materialId) == String(beefId)
          && String(row.inventoryDay).indexOf('2026-04-10') >= 0
        )
        CheckUtil.expectEqual(beefInv != null, true, '4/10应有牛肉盘点单')
        CheckUtil.expectEqual(Number(beefInv.cost), 999, '牛肉盘点单金额应为999')
        CheckUtil.expectEqual(costByDay['2026-04-10'], 208, '4/10 afterStocks应为牛肉200+鸡蛋8，不能是盘点单999+8')
        CheckUtil.expectEqual(costByDay['2026-04-20'], 62, '4/20 afterStocks应为羊肉50+白菜12')
      },
      buildVariable() {
        return {
          inventoryDayCost: variable.inventoryDayCost
        }
      }
    }))
    ret.push(new Action({
      name: '校验盘点日金额',
      remark: 'listInventoryDay.cost 等于各物料 afterStocks 合计；当天未完成盘点没有流水，cost=0',
      url: '/app/inventory/listInventoryDay',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        pageSize: 100
      }
    }, {
      check(result) {
        let content = result?.result?.content ?? []
        let costByDay = variable.inventoryDayCost ?? {}
        CheckUtil.expectEqual(content.length > 0, true, '盘点日列表不应为空')
        for (let row of content) {
          let day = String(row.inventoryDay).substring(0, 10)
          let expected = costByDay[day] ?? 0
          CheckUtil.expectEqual(
            Number(row.cost),
            expected,
            `${day}的cost应为afterStocks合计${expected}，实际=${row.cost}`
          )
        }
        let april10 = findInventoryDay(content, '2026-04-10')
        let april20 = findInventoryDay(content, '2026-04-20')
        let todayRow = findInventoryDay(content, today)
        CheckUtil.expectEqual(Number(april10.cost), 208, '4/10 cost')
        CheckUtil.expectEqual(Number(april20.cost), 62, '4/20 cost')
        CheckUtil.expectEqual(Number(todayRow.cost), 0, '未完成盘点日cost应为0')
        CheckUtil.expectEqual(Number(april10.cost) == 1007, false, '4/10不能使用盘点单金额999+8')
      }
    }))
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

/** afterStocks 批次数组的金额合计，与 StockRecordDomain.getEndStock().cost 一致。 */
function parseAfterCost(afterStocks: any): number {
  if (afterStocks == null || afterStocks === '' || afterStocks === 'null') {
    return 0
  }
  let raw = afterStocks
  if (typeof raw == 'string') {
    raw = JSON.parse(raw)
  }
  let array = raw?.array ?? []
  let cost = 0
  for (let row of array) {
    cost += Number(row?.cost ?? 0)
  }
  return Math.round(cost * 100) / 100
}

function toInventoryDay(bussinessDate: any): string {
  let text = DateUtil.formatDate(new Date(bussinessDate))
  return String(text).substring(0, 10)
}

/** 同一物料同一天按 stockRecordId 留最后一条，再按日把 afterStocks 金额相加。 */
function sumInventoryDayCost(records: any[]): { [day: string]: number } {
  let latest: { [key: string]: any } = {}
  for (let record of records) {
    if (record.type != 'Inventory') {
      continue
    }
    if (record.isDel != null && Number(record.isDel) != 0) {
      continue
    }
    let day = toInventoryDay(record.bussinessDate)
    let key = record.materialId + '$' + day
    let old = latest[key]
    if (old == null || Number(record.stockRecordId) > Number(old.stockRecordId)) {
      latest[key] = record
    }
  }
  let costByDay: { [day: string]: number } = {}
  for (let key of Object.keys(latest)) {
    let record = latest[key]
    let day = toInventoryDay(record.bussinessDate)
    let cost = (costByDay[day] ?? 0) + parseAfterCost(record.afterStocks)
    costByDay[day] = Math.round(cost * 100) / 100
  }
  return costByDay
}

function findInventoryDay(content: any[], day: string): any {
  let row = content.find((item: any) => String(item.inventoryDay).indexOf(day) >= 0)
  CheckUtil.expectEqual(row != null, true, `日期列表缺少 ${day}，实际=${JSON.stringify(content)}`)
  return row
}
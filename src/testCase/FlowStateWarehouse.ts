import { ArrayUtil, BaseTest, CheckUtil, DateUtil, HttpAction, TestCase } from "testflow";
import PreTest from "./PreTest";
import Action from "../action/Action";
import CreateNote3M from "../action/note/CreateNote3M";
import BatchProcessNote from "../action/note/BatchProcessNote";
import ListNoteGroup from "../action/note/ListNoteGroup";
const S_Days = 10
export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [new PreTest()];

    for (let i = S_Days; i >= 0; i--) {
      ret.push(... this.buildDay(i))
    }
    ret.push(this.buildState())
    ret.push(this.buildCheckers())
    return ret;
  }

  buildCheckers() {
    let self = this;
    return new Action({
      url: '/free/query',
      name: '检查',
      param: {
        array: [
          {
            table: 'stockRecord',
            query: {
              warehouseId: '${warehouse.warehouseId}'
            }
          },
          {
            table: 'stateMaterial',
            query: {
              warehouseId: '${warehouse.warehouseId}'
            }
          },
          {
            table: 'stateWarehouse',
            query: {
              warehouseId: '${warehouse.warehouseId}'
            }
          }
        ]
      }
    }, {
      async check(result) {
        result = result.result
        let stockRecord: any[] = result.stockRecord;
        let stateWarehouse: any[] = result.stateWarehouse;
        let stateMaterial: any[] = result.stateMaterial;
        let today = DateUtil.todayStr();
        let yesterday = DateUtil.format(DateUtil.beforeDay(DateUtil.today(), 1))
        stockRecord = stockRecord.filter(row => {
          let sysAddTime = new Date(row.sysAddTime);
          return today != DateUtil.format(sysAddTime)
        })
        let sumObj = ArrayUtil.sumObj(
          stateMaterial, ['openingAmount', 'endAmount', 'instockAmount', 'amount']
        )
        sumObj.openningAmount = sumObj.openingAmount //两个字段不一样的锅
        CheckUtil.expectEqualObj(
          sumObj,
          ArrayUtil.sumObj(stateWarehouse, ['openningAmount', 'endAmount', 'instockAmount', 'amount'])
        )

        let last = stateWarehouse.find(row => row.date == yesterday)
        CheckUtil.expectEqual(last.endAmount, ArrayUtil.sum(stockRecord, 'cost'))
        await self.checkMaterialCnt(stockRecord, stateMaterial)

      }
    })
  }

  private async checkMaterialCnt(stockRecord: any[], stateMaterials: any[]) {
    let stockRecordMap = ArrayUtil.toMapArray(stockRecord, 'materialId')
    let stateMaterialsMap = ArrayUtil.toMapArray(stateMaterials, 'materialId');
    for (let e in stockRecordMap) {
      await this.doCheckMaterialCnt(stockRecordMap[e], stateMaterialsMap[e])
    }
  }

  private async doCheckMaterialCnt(stockRecords: any[], stateMaterials: any[]) {

    let inventorys = stockRecords.filter(
      (row) => row.type == 'InventoryDel' || row.type == 'InventoryAdd'

    )

    ArrayUtil.order(stateMaterials,'opening')
    let last = stateMaterials[stateMaterials.length-1]
    let action = new HttpAction({
      url: '/free/stock',
      name: '检查盘点库存',
      param: {

        action: 'sumAndEq',
        array1: inventorys.map(row => ({ cnt: -row.cnt, buyUnitFee: row.buyUnitFee })),
        array2: stateMaterials.map(row => ({ cnt: row.cnt, buyUnitFee: row.buyUnitFee })),
        msg: '盘点数量不对'
      }
    })
    await action.test()
    console.log({ cnt: last.endCnt, buyUnitFee: last.buyUnitFee });
    console.log(stockRecords.map(row => ({ cnt: row.cnt, buyUnitFee: row.buyUnitFee })));
    let checkLast = new HttpAction({
      url: '/free/stock',
      name: '检查最后数量',
      param: {

        action: 'isEq',
        array1: stockRecords.map(row => ({ cnt: row.cnt, buyUnitFee: row.buyUnitFee })),
        stock2: { cnt: last.endCnt, buyUnitFee: last.buyUnitFee } ,
        msg: '最后数量不对'
      }
    })
    await checkLast.test()

  }


  getName(): string {
    return '统计'
  }

  buildState() {
    let date = DateUtil.beforeDay(new Date(), S_Days)
    return new Action({
      url: '/app/state/stateWarehouse',
      name: '正式统计',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        opening: DateUtil.format(date),
        end: DateUtil.todayStr()
      }
    })
  }

  buildDay(index: number): BaseTest[] {

    let ret: BaseTest[] = [
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
    if (index > 0 && index % 5 == 0) {
      ret.push(new Action({
        name: '盘点猪肉',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { "cnt": 5, "buyUnitFee": 1, "stockUnitsId": 18 },
          "materialId": '${materialMap.猪肉.materialId}',
          "warehouseId": '${warehouse.warehouseId}'
        }
      }))

      ret.push(new Action({
        name: '盘点牛肉',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { cnt: 2, buyUnitFee: 1, stockUnitsId: 18 },
          "materialId": '${materialMap.牛肉.materialId}',
          "warehouseId": '${warehouse.warehouseId}'
        }
      }))

      ret.push(new Action({
        name: '盘点羊肉',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { cnt: 10, buyUnitFee: 500, stockUnitsId: 29 },
          "materialId": '${materialMap.羊肉.materialId}',
          "warehouseId": '${warehouse.warehouseId}'
        }
      }))
    }
    ret.push(
      ... this.buildUpdate(index)
    )
    return ret;
  }

  buildUpdate(index: number) {
    let ret: any[] = []
    let date = DateUtil.beforeDay(new Date(), index);

    if (index > 0) {
      ret.push(new Action(
        {
          name: `更新第${index}天stockrecord数据`,
          param: {
            table: 'stockRecord',
            cdts: [
              {
                val: '${warehouse.warehouseId}',
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

      ret.push(new Action(
        {
          name: `更新第${index}天订单数据`,
          param: {
            table: 'note',
            cdts: [
              {
                val: '${warehouse.warehouseId}',
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
    return ret;
  }

}
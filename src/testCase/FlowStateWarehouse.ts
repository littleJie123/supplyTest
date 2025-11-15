import { ArrayUtil, BaseTest, CheckUtil, DateUtil, HttpAction, TestCase } from "testflow";
import PreTest from "./PreTest";
import Action from "../action/Action";
import CreateNote3M from "../action/note/CreateNote3M";
import BatchProcessNote from "../action/note/BatchProcessNote";
import ListNoteGroup from "../action/note/ListNoteGroup";
const S_Days = 10
const S_last = 120
interface CheckOpt {
  endAmount?: number;
  notCheckEndAmount?: boolean
}
export default class extends TestCase {
  private cntMap: any = {
    牛肉: 50,
    猪肉: 400,
    羊肉: 800
  }
  /**
   * 过滤出退货和入库的记录
   * @param stockRecord 
   */
  filterInstockAndBack(stockRecord: any[]) {
    return stockRecord.filter(
      row => ['Back', 'Instock'].includes(row.type)
    )
  }
  protected buildActions(): BaseTest[] {
    let ret: BaseTest[] = [new PreTest()];

    for (let i = S_Days; i >= 0; i--) {
      ret.push(... this.buildDay(i))
    }
    ret.push(this.buildState())
    ret.push(this.buildCheckers())
    ret.push(... this.buildDel());
    ret.push(this.buildState({
      begin: S_Days,
      end: 5
    }))
    ret.push(this.buildState({
      begin: 5
    }))
    ret.push(this.buildCheckers())

    ret.push(... this.buildDelAll());


    for (let i = S_Days; i >= 0; i--) {
      ret.push(... this.buildDay4Inventory(i))
    }
    ret.push(this.buildState({
      begin: 5,
      end: 2,
      name: '前五天'
    }))
    ret.push(this.buildState({
      name: '倒数第二天',
      begin: 1,
      end: 1
    }))
    ret.push(new Action({
      name: '最后一天盘点牛肉',
      url: '/app/inventory/setInventory',
      param: {
        "stock": { cnt: S_last, buyUnitFee: 1, stockUnitsId: 18 },
        "materialId": '${materialMap.牛肉.materialId}',
        "warehouseId": '${warehouse.warehouseId}'
      }
    }))
    ret.push(this.buildState({
      name: '最后1天',
      begin: 0,
      end: 0,
      result: {
        "openningAmount": 1350,
        "endAmount": 850,
        "amount": 500,
        "instockAmount": 0
      }
    }))
    ret.push(this.buildCheckers({
      endAmount: 500 + 1000 * (170) / 200
    }))
    return ret;
  }

  buildDay4Inventory(index: number): BaseTest[] {
    let ret: BaseTest[] = []
    if (index == S_Days) {
      ret.push(new Action({
        name: '盘点牛肉',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { cnt: 200, buyUnitFee: 1, stockUnitsId: 18 },
          "materialId": '${materialMap.牛肉.materialId}',
          "warehouseId": '${warehouse.warehouseId}'
        }
      }))

      ret.push(new Action({
        name: '更新stockRecord cost',
        url: '/free/update',
        param: {
          table: 'stockRecord',
          data: {
            cost: 1000
          },
          whereCdt: {
            warehouseId: '${warehouse.warehouseId}'
          }

        }
      }))

      ret.push(new Action({
        name: '更新stock cost',
        url: '/free/update',
        param: {
          table: 'stock',
          data: {
            cost: 1000
          },
          whereCdt: {
            warehouseId: '${warehouse.warehouseId}'
          }

        }
      }))
    }

    if (index == S_Days - 3) {
      ret.push(new Action({
        name: '盘点牛肉',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { cnt: 180, buyUnitFee: 1, stockUnitsId: 18 },
          "materialId": '${materialMap.牛肉.materialId}',
          "warehouseId": '${warehouse.warehouseId}'
        }
      }))
    }
    if (index == S_Days - 6) {
      ret.push(new Action({
        name: '下单牛肉',
        url: '/app/note/createNote',
        method: 'post',
        param: {
          "items": [
            {
              "materialId": '${materialMap.牛肉.materialId}',
              "supplierId": '${supplierMap.供应商2}',
              "cnt": 50,
              "buyUnitFee": 1,
              "stockUnitsId": 18,
              "price": 10,
              "stockBuyUnitFee": 1
            }],
          "warehouseId": '${warehouse.warehouseId}',
          "warehouseGroupId": '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          let ret: any = {}
          let content: any[] = result.result;
          ret.noteIds = ArrayUtil.toArray(content, 'noteId')
          return ret;
        }
      }))
      ret.push(new Action({
        name: '发送订单',
        url: '/app/note/sendNote',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      })
      )
      ret.push(new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal',

      })),
      ret.push(new BatchProcessNote({
        action: 'instock'
      }))
    }
    if (index == S_Days - 8) {
      ret.push(new Action({
        name: '盘点牛肉',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { cnt: 220, buyUnitFee: 1, stockUnitsId: 18 },
          "materialId": '${materialMap.牛肉.materialId}',
          "warehouseId": '${warehouse.warehouseId}'
        }
      }))
    }



    if (ret.length > 0) {
      if (index != 0) {
        ret.push(
          ... this.buildUpdate(index)
        )
      }
    }
    return ret;
  }

  buildDelAll(): BaseTest[] {
    return this.buildTables([
      'stock',
      'stockRecord',
      'stateWarehouse',
      'stateMaterial',
      'noteItem',
      'note'
    ])
  }

  buildTables(tables: string[]): BaseTest[] {
    let ret: BaseTest[] = [];
    for (let table of tables) {
      ret.push(new Action({
        name: `删除${table}`,
        url: '/free/del',
        param: {
          query: {
            warehouseId: '${warehouse.warehouseId}'
          },
          table
        }
      }))
    }
    return ret;
  }

  buildDel(): BaseTest[] {
    return [
      new Action({
        name: '删除stateWarehouse',
        url: '/free/del',
        param: {
          query: {
            warehouseId: '${warehouse.warehouseId}'
          },
          table: 'stateWarehouse'
        }
      }),
      new Action({
        name: '删除stateMaterial',
        url: '/free/del',
        param: {
          query: {
            warehouseId: '${warehouse.warehouseId}'
          },
          table: 'stateMaterial'
        }
      })
    ]
  }

  buildCheckers(checkOpt?: CheckOpt) {
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
        ArrayUtil.order(stateWarehouse, 'date');
        let lastStateWarehouse = stateWarehouse[stateWarehouse.length - 1]
        let stateMaterial: any[] = result.stateMaterial;
        let lastStateMaterial = stateMaterial.filter(row => row.end == lastStateWarehouse.date || row.end == '')
        CheckUtil.expectEqual(
          lastStateWarehouse.endAmount,
          ArrayUtil.sum(lastStateMaterial, 'endAmount'),
          '期末金额不相等'
        )
        let today = DateUtil.todayStr();
        //今天的数据不会产生
        stockRecord = stockRecord.filter(row => {
          let sysAddTime = new Date(row.sysAddTime);
          return today != DateUtil.format(sysAddTime)
        })

        let sumObj = ArrayUtil.sumObj(
          stateMaterial, ['amount', 'instockAmount']
        )
        let sumStateMaterial = ArrayUtil.sumObj(stateWarehouse, ['amount', 'instockAmount'])
        //检查state_material 和state_warehouse 的金额是否能对上
        CheckUtil.expectEqualObj(
          sumObj,
          sumStateMaterial,
          `入库金额和消耗金额不相等 ${JSON.stringify(sumObj)} 和 ${JSON.stringify(sumStateMaterial)}`
        )

        let instockStocks = self.filterInstockAndBack(stockRecord)
        CheckUtil.expectEqual(sumObj.instockAmount, ArrayUtil.sum(instockStocks, 'cost'))
        await self.checkMaterialCnt(stockRecord, stateMaterial, checkOpt)

      }
    })
  }

  private async checkMaterialCnt(stockRecord: any[], stateMaterials: any[], checkOpt?: CheckOpt) {
    let stockRecordMap = ArrayUtil.toMapArray(stockRecord, 'materialId')
    let stateMaterialsMap = ArrayUtil.toMapArray(stateMaterials, 'materialId');
    for (let e in stockRecordMap) {
      await this.doCheckMaterialCnt(stockRecordMap[e], stateMaterialsMap[e], checkOpt)
    }
  }

  private async doCheckMaterialCnt(stockRecords: any[], stateMaterials: any[], checkOpt?: CheckOpt) {

    let inventorys = stockRecords.filter(
      (row) => row.type == 'InventoryDel' || row.type == 'InventoryAdd'

    )
    let instocks = stockRecords.filter(
      (row) => row.type == 'Instock'
    )
    ArrayUtil.order(stateMaterials, 'opening')
    let endCost = stateMaterials[stateMaterials.length - 1].endAmount;
    if (checkOpt?.endAmount == null) {
      //默认检查
      ArrayUtil.order(instocks, 'sysAddTime');
      let instockCost = instocks[instocks.length - 1].cost + 0.5 * instocks[instocks.length - 2].cost

      CheckUtil.expectEqual(instockCost, endCost, `${stateMaterials[0].materialId}的最后金额出错了。${instockCost}和${endCost}`);
    } else {
      if (!checkOpt?.notCheckEndAmount) {
        CheckUtil.expectEqual(checkOpt.endAmount, endCost, `${stateMaterials[0].materialId}的最后金额出错了。${checkOpt.endAmount}和${endCost}`);
      }
    }
    let last = stateMaterials[stateMaterials.length - 1]
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

    let checkLast = new HttpAction({
      url: '/free/stock',
      name: '检查最后数量',
      param: {

        action: 'isEq',
        array1: stockRecords.map(row => ({ cnt: row.cnt, buyUnitFee: row.buyUnitFee })),
        stock2: { cnt: last.endCnt, buyUnitFee: last.buyUnitFee },
        msg: '最后数量不对'
      }
    })
    await checkLast.test()

  }


  getName(): string {
    return '统计'
  }

  buildState(opt?: {
    begin?: number,
    end?: number,
    result?: any
    name?: string

  }) {
    let date = DateUtil.beforeDay(new Date(), opt?.begin ?? S_Days)
    let end = DateUtil.beforeDay(new Date(), opt?.end ?? 0)
    return new Action({
      url: '/app/state/stateWarehouse',
      name: opt?.name ?? '正式统计',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        opening: DateUtil.format(date),
        end: DateUtil.format(end)
      }
    }, {
      check(result) {
        if (opt?.result) {
          CheckUtil.expectEqualObj( result.result.result,opt?.result)
        }
      },
    })
  }

  buildDay(index: number): BaseTest[] {

    let priceFee = index;
    if (priceFee == 0) {
      priceFee = 0.5
    }
    let ret: BaseTest[] = [
      new CreateNote3M({
        priceFee,
        notCheck: true,
        cntMap: this.cntMap
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'normal',

        noteCnt: 2
      }),
      new BatchProcessNote({
        action: 'instock'
      })

    ]
    if (index == 7) {
      // ret.push(new Action({
      //   name: '增加羊肉特殊单位',
      //   url: '/free/add',
      //   param: {
      //     table: 'stockRecord',
      //     array: [
      //       {
      //         buyUnitFee: 1,
      //         cnt: 1,
      //         type: 'InventoryAdd',
      //         "materialId": '${materialMap.羊肉.materialId}',
      //         "warehouseId": '${warehouse.warehouseId}',
      //         "warehouseGroupId": '${warehouse.warehouseGroupId}'
      //       }
      //     ]
      //   }
      // }))
    }
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
    if (index == 1) {
      let cntMap = this.cntMap;
      ret.push(new Action({
        name: '盘点猪肉1.5',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { "cnt": cntMap['猪肉'] * 1.5, "buyUnitFee": 1, "stockUnitsId": 18 },
          "materialId": '${materialMap.猪肉.materialId}',
          "warehouseId": '${warehouse.warehouseId}'
        }
      }))

      ret.push(new Action({
        name: '盘点牛肉',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { cnt: cntMap['牛肉'] * 1.5, buyUnitFee: 1, stockUnitsId: 18 },
          "materialId": '${materialMap.牛肉.materialId}',
          "warehouseId": '${warehouse.warehouseId}'
        }
      }))

      ret.push(new Action({
        name: '盘点羊肉',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { cnt: cntMap['羊肉'] * 1.5, buyUnitFee: 500, stockUnitsId: 29 },
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
import { ArrayUtil, BaseTest, CheckUtil, DateUtil, HttpAction, TestCase } from "testflow";
import PreTest from "./PreTest";
import Action from "../action/Action";
import BatchProcessNote from "../action/note/BatchProcessNote";
import ListNoteGroup from "../action/note/ListNoteGroup";
import { endianness } from "os";
const S_Days = 90;
const S_InstockDay = 15;

interface CheckOpt {
  endAmount?: number;
  notCheckEndAmount?: boolean
}
export default class extends TestCase {
  protected buildActions(): BaseTest[] {

    let dateOfPigInstock = this.getDay(S_Days - S_InstockDay - 1); //猪肉的第一次入库时间
    let ret: BaseTest[] = [new PreTest()];
    for (let i = S_Days; i >= 0; i--) {
      ret.push(... this.buildDay(i))
    }
    ret.push(... this.buildStateByDays())
    ret.push(
      new Action({
        name: '查询未付费项目',
        url: '/app/state/listNoCost',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          begin: this.getDay(S_Days),
          end: this.getDay()
        }
      }, {
        check(result) {
          let content = result.result.content;
          CheckUtil.expectEqual(content.length, 6)
        },
        buildVariable(result) {
          let content = result.result.content;
          return {
            noCost: content
          }
        }
      })


    )

    ret.push(this.buildUpdatePrice(dateOfPigInstock))

    ret.push(new Action({
      name: '查询数据库验证',
      url: '/free/query',
      param: {
        array: [
          {
            table: 'stateMaterial',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              isDel: 0
            }
          },
          {
            table: 'stateWarehouse',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              isDel: 0
            }
          },
        ]
      }
    }, {
      check(result) {
        result = result.result
        let stateMaterial = result.stateMaterial;
        let endIsBlanks = stateMaterial.filter(row => row.end == '');
        CheckUtil.expectEqual(endIsBlanks.length <= 2, true);
        let bigThenPigInstock = stateMaterial.filter(
          row => row.opening >= dateOfPigInstock || row.end >= dateOfPigInstock
        )
        CheckUtil.expectEqual(bigThenPigInstock.length, 0);
        let stateWarehouse = result.stateWarehouse.filter(row => row.date >= dateOfPigInstock);
        CheckUtil.expectEqual(stateWarehouse.length, 0);
      }
    }))

    ret.push(this.buildUpdatePrice(dateOfPigInstock, true))

    ret.push(... this.buildStateByDays())

    ret.push(this.buildCheckers());



    return ret;
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
              warehouseId: '${warehouse.warehouseId}',
              isDel:0
            }
          },
          {
            table: 'stateMaterial',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              isDel:0
            }
          },
          {
            table: 'stateWarehouse',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              isDel:0
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
  /**
   * 过滤出退货和入库的记录
   * @param stockRecord 
   */
  filterInstockAndBack(stockRecord: any[]) {
    return stockRecord.filter(
      row => ['Back', 'Instock'].includes(row.type)
    )
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
    if (checkOpt?.endAmount != null) {
       
      
      CheckUtil.expectEqual(checkOpt.endAmount, endCost, `${stateMaterials[0].materialId}的最后金额出错了。${checkOpt.endAmount}和${endCost}`);
      
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

  buildUpdatePrice(dateOfPigInstock: string, allUpdate?: boolean): BaseTest {
    let variable = this.getVariable();
    return new Action({
      name: '更改价格',
      url: '/app/note/updatePrice'
    }, {
      parseHttpParam: (param) => {
        let noCost: any[] = variable.noCost;
        let retParam: any = {
          opt:{
            hasStockRecords:true
          }
        };
        let noteItems: any[] = [];
        retParam.noteItems = noteItems
        retParam.warehouseId = variable.warehouse.warehouseId;
        retParam.warehouseGroupId = variable.warehouse.warehouseGroupId;


        for (let item of noCost) {
          if (dateOfPigInstock == item.sysAddTime || allUpdate) {
            let price = this.buildPrice(item);
            noteItems.push({
              noteItemId: item.noteItemId,
              price,
              stockBuyUnitFee: 1,
              stockRecord: {
                cost: price * item.stock,
                stockRecordId: item.stockRecordId
              }
            })
          }
        }
        return retParam;
      },
    })
  }
  buildPrice(item: any): number {
    let price = 10;
    if (item.name == '猪肉') {
      price = 20
    }
    if (item.type == 'InventoryAdd') {
      price += 5;
    }
    return price;
  }

  getDay(begin?: number): string {
    let today = DateUtil.today();
    if (begin) {
      today = DateUtil.beforeDay(today, begin)
    }
    return DateUtil.format(today);
  }

  buildStateByDays(): BaseTest[] {
    let ret: BaseTest[] = []
    ret.push(this.buildState({
      name: '统计【到牛肉入库日】',
      end: S_Days - S_InstockDay

    }))
    ret.push(this.buildState({
      name: '统计【从牛肉入库日开始】',
      begin: S_Days - S_InstockDay - 1,
      end: 60
    }))

    ret.push(this.buildState({
      name: '统计【最近一个月】',
      begin: 30
    }))
    return ret;
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
          CheckUtil.expectEqualObj(opt?.result, result.result.result)
        }
      },
    })
  }
  buildDay(index: number): BaseTest[] {
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
    }

    if (index == S_Days - 1) {
      ret.push(new Action({
        name: '盘点猪肉',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { cnt: 100, buyUnitFee: 1, stockUnitsId: 18 },
          "materialId": '${materialMap.猪肉.materialId}',
          "warehouseId": '${warehouse.warehouseId}'
        }
      }))
    }

    if (index == S_Days - S_InstockDay) {
      ret.push(... this.buildInstock('牛肉'))
    }

    if (index == S_Days - S_InstockDay - 1) {
      ret.push(... this.buildInstock('猪肉'))
    }

    if (index == S_Days - S_InstockDay - 30) {
      ret.push(... this.buildInstock('牛肉'))
    }

    if (index == S_Days - S_InstockDay - 1 - 30) {
      ret.push(... this.buildInstock('猪肉'))
    }

    if (index == S_Days - 20) {
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
    if (index == S_Days - 21) {
      ret.push(new Action({
        name: '盘点猪肉',
        url: '/app/inventory/setInventory',
        param: {
          "stock": { cnt: 30, buyUnitFee: 1, stockUnitsId: 18 },
          "materialId": '${materialMap.猪肉.materialId}',
          "warehouseId": '${warehouse.warehouseId}'
        }
      }))
    }
    if (ret.length > 0) {
      ret.push(... this.buildUpdate(index));
    }
    return ret;
  }


  buildInstock(name: string): BaseTest[] {
    let ret: BaseTest[] = []
    ret.push(new Action({
      name: `下单${name}`,
      url: '/app/note/createNote',
      method: 'post',
      param: {
        "items": [
          {
            "materialId": `\${materialMap.${name}.materialId}`,
            "supplierId": '${supplierMap.供应商2}',
            "cnt": 50,
            "buyUnitFee": 1,
            "stockUnitsId": 18,
            "price": 0,
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
  getName(): string {
    return '统计【0 cost】'
  }

}
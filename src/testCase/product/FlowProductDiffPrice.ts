import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import BuildInventory from "../../action/case/BuildInventory";
import BatchProcessNote from "../../action/note/BatchProcessNote";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import BuildUpdateStock from "../../action/case/BuildUpdateStock";

export default class extends TestCase {
  beginMaterial: number;
  getName(): string {
    return '餐品模型[不同价格]'
  }

  private buildProductAndBom(): BaseTest[] {
    return [

      new Action({
        name: '增加餐品',
        url: '/app/product/addProduct',
        param: {
          name: '红烧肉'
        }
      }, {
        buildVariable(result) {
          result = result.result
          return {
            productId: result.productId
          }
        }
      }),
      new Action({
        name: '保存bom',
        url: '/app/bom/saveBom',
        param: {
          "productId": '${productId}',
          "boms": [
            {
              "materialId": '${materialMap.猪肉.materialId}',
              "cnt": 10,
              "buyUnitFee": 1,
              "yieldRate": 0.5,
              "netCnt": 0.5,
              "stockBuyUnitFee": 1,
              "price": 1
            },


          ]
        }
      }),
      new Action({
        name: '增加餐品',
        url: '/app/product/addProduct',
        param: {
          name: '白菜猪肉'
        }
      }, {
        buildVariable(result) {
          result = result.result
          return {
            productId: result.productId
          }
        }
      }),
      new Action({
        name: '保存bom',
        url: '/app/bom/saveBom',
        param: {
          "productId": '${productId}',
          "boms": [
            {
              "materialId": '${materialMap.猪肉.materialId}',
              "cnt": 10,
              "buyUnitFee": 1,
              "yieldRate": 0.5,
              "netCnt": 0.5,
              "stockBuyUnitFee": 1,
              "price": 1.5
            },
            {
              "materialId": '${materialMap.白菜.materialId}',
              "cnt": 10,
              "buyUnitFee": 1,
              "yieldRate": 0.5,
              "netCnt": 0.5,
              "stockBuyUnitFee": 1,
              "price": 2
            }


          ]
        }
      }),

      new Action({
        name: '增加餐品',
        url: '/app/product/addProduct',
        param: {
          name: '煮鸡蛋'
        }
      }, {
        buildVariable(result) {
          result = result.result
          return {
            productId: result.productId
          }
        }
      }),
      new Action({
        name: '保存bom',
        url: '/app/bom/saveBom',
        param: {
          "productId": '${productId}',
          "boms": [
            {
              "materialId": '${materialMap.鸡蛋.materialId}',
              "cnt": 10,
              "buyUnitFee": 1,
              "yieldRate": 0.5,
              "netCnt": 0.5,
              "stockBuyUnitFee": 1,
              "price": 2.5
            },



          ]
        }
      }),
    ]
  }
  protected buildActions(): BaseTest[] {
    return [
      ... new PreTest().getActions(),
      ... this.buildProductAndBom(),
      ... new BuildInventory({
        dayCnt: 7,
        defVal: 100,
        defCost: 100,
        nameArray: ['猪肉', '白菜', '鸡蛋']
      }).getActions(),
      ... new BuildInventory({
        dayCnt: 7,
        defVal: 200,
        defCost: 150,
        nameArray: ['猪肉', '白菜', '鸡蛋']
      }).getActions(),



      ... this.buildNote(6, {
        needInstock: true,
        cnt: 10,
        buyUnitFee: -10,
        price: 2, 
      }),

      ... this.buildNote(6, {
        handInstock: true,
        cnt: 1,
        buyUnitFee: -100,
        price: 2,
        supplier: '供应商2',
         
      }),
      ... this.buildNote(6, {
        needStatement: true,
        cnt: 10,
        buyUnitFee: -10,
        price: 2.5,
        supplier: '供应商2'
      }),





      new Action({
        name: '查询餐品',
        url: '/app/product/listProduct',
        param: {}
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content;
          return {
            product: ArrayUtil.toMapByKey(content, 'name', 'productId')
          }
        }
      }),

      this.buildImportProduct(),
      new Action({
        name: '全部计算',
        url: '/free/stateMaterial/recalStateMaterial',
        param: {
          warehouseId: '${warehouse.warehouseId}'

        }
      }),
      ... this.buildCheckAction()




    ]
  }

  private buildCheckAction(): BaseTest[] {
    let ret: BaseTest[] = []
    ret.push(
      new Action({
        name: '餐品成本物料价格',
        url: '/app/state/analyseMaterialPriceOfProduct',
        param: {
          "warehouseId": '${warehouse.warehouseId}',
          "productId": '${product.白菜猪肉}',
          "materialId": '${materialMap.白菜.materialId}',
          "begin": StrDateUtil.beforeDay(7),
          "end": DateUtil.todayStr()
        }
      }, {
        check(result) {
          let content = result?.result?.content;
          CheckUtil.expectEqualArray(content, [
            {
              "price": {
                "price": 100,
                "buyUnitFee": -100
              },
              "begin": StrDateUtil.beforeDay(5),
              "end": StrDateUtil.beforeDay(4),
              "cnt": {
                "cnt": 200,
                "buyUnitFee": 1
              },
              "cost": 200
            },
            {
              "price": {
                "price": 2,
                "buyUnitFee": 1
              },
              "begin": StrDateUtil.beforeDay(4),
              "end": StrDateUtil.beforeDay(3),
              "cnt": {
                "cnt": 200,
                "buyUnitFee": 1
              },
              "cost": 400
            },
            {
              "price": {
                "price": 2.5,
                "buyUnitFee": 1
              },
              "begin": StrDateUtil.beforeDay(2),
              "end": StrDateUtil.beforeDay(2),
              "cnt": {
                "cnt": 10,
                "buyUnitFee": -10
              },
              "cost": 250
            }
          ])
        }
      })
    )



    return ret;
  }

  private buildImportProduct(): Action {
    return new Action({
      name: '上传销售记录',
      url: '/app/salesRecord/importSalesRecord',
      param: {
        datas: [
          ... this.buildDay(-5, 8),
          ... this.buildDay(-4, 14),
          ... this.buildDay(-3, 17),
          ... this.buildDay(-2, 20),
          ... this.buildDay(-2, 1)
        ],
        warehouseId: '${warehouse.warehouseId}'
      }
    })
  }

  private buildDay(day: number, cnt: number): any[] {
    return [

      {
        product: {
          name: '白菜猪肉',
          id: '${product.白菜猪肉}'
        },
        salesRecord: {
          name: this.getDate(Math.abs(day))
        },
        cnt: {
          name: Math.abs(cnt)
        }
      },
      {
        product: {
          name: '煮鸡蛋',
          id: '${product.煮鸡蛋}'
        },
        salesRecord: {
          name: this.getDate(Math.abs(day))
        },
        cnt: {
          name: Math.abs(cnt)
        }
      }
    ]
  }

  private getDate(day: number): number {
    let date = new Date();
    date = DateUtil.beforeDay(date, day);
    let ret = DateUtil.toExcelDateNum(date);

    return ret;
  }

  private buildBack(day: number) {
    let ret: BaseTest[] = [];
    ret.push(new Action({
      name: '创建退货单',
      url: '/app/noteBack/createNoteBack',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        items: '${note.noteItems}'
      }
    }))
    ret.push(
      ... new BuildUpdateStock({
        dayCnt: day,
        tables: ['stockRecord', 'note', 'noteItem']
      }).getActions()
    )
    return ret;
  }

  private buildNote(day: number, opt?: {
    needInstock?: boolean;
    needStatement?: boolean;
    handInstock?: boolean
    supplier?: string
    cnt?: number
    buyUnitFee?: number
    price?: number;
    instockCnt?: number;
    yieldRate?: number
  }): BaseTest[] {
    let names = ['猪肉', '白菜', '鸡蛋']
    let price = opt?.price ?? 2;
    let cnt = opt?.cnt ?? 100
    let buyUnitFee = opt?.buyUnitFee ?? 1;

    let ret: BaseTest[] = [];
    let items: any[] = [];
    for (let i = 0; i < names.length; i++) {
      let name = names[i]
      items.push({
        "materialId": `\${materialMap.${name}.materialId}`,
        "supplierId": '${supplierMap.' + (opt?.supplier ?? '供应商1') + '}',
        "cnt": cnt,
        "buyUnitFee": buyUnitFee,
        "stockUnitsId": 0,
        "price": price,
        "stockBuyUnitFee": 1
      })
    }

    ret.push(new Action({
      name: `下单物料`,
      url: opt?.handInstock ? '/app/note/createHandInstock' : '/app/note/createNote',
      method: 'post',
      param: {
        items,
        "warehouseId": '${warehouse.warehouseId}',
        "warehouseGroupId": '${warehouse.warehouseGroupId}'
      }
    }, {
      buildVariable(result: any) {
        let ret: any = {}
        let content: any[] = result.result;
        ret.noteIds = ArrayUtil.toArray(content, 'noteId')
        ret.note = content[0]
        return ret;
      }
    }))
    if (!opt?.handInstock) {
      ret.push(new Action({
        url: '/app/note/sendNote',
        name: '发送订单',
        param: {
          noteIds: '${noteIds}',
          status: 'normal'
        }
      }));
      if (opt?.needInstock || opt?.needStatement) {
        ret.push(new ListNoteGroup({
          groupType: 'NoteDay',
          status: 'normal',

        }));
        ret.push(new Action({
          name:'入库',
          url: '/app/note/processNote',
          param: {
            "noteId": '${note.noteId}',
             
            "action": "instock",
            "warehouseId": '${warehouse.warehouseId}', 
          }
        }, {
          parseHttpParam: (ret: any) => {
            let variable = this.getVariable();
            let noteItems: any[] = variable.note.noteItems;
            noteItems = noteItems.map(row => ({
              "noteItemId": row.noteItemId,
              "cnt": row.cnt,
              "instockCnt": opt?.instockCnt ?? row.cnt,

              "price": row.price,
              "stockBuyUnitFee": row.stockBuyUnitFee,
              "materialId": row.materialId,
              "yieldRate": opt?.yieldRate ?? 0
            }))
            ret.noteItems = noteItems;
            return ret;
          }
        }))

      }

      if (opt?.needStatement) {
        ret.push(new ListNoteGroup({
          groupType: 'NoteDay',
          status: 'instocked',

        }));
        ret.push(new BatchProcessNote({
          action: 'statement'
        }))



      }

    }
    ret.push(
      ... new BuildUpdateStock({
        dayCnt: day,
        tables: ['stockRecord', 'note', 'noteItem']
      }).getActions()
    )
    return ret;
  }

}
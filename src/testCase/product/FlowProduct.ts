import { ArrayUtil, BaseTest, DateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import BuildInventory from "../../action/case/BuildInventory";
import BatchProcessNote from "../../action/note/BatchProcessNote";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import BuildUpdateStock from "../../action/case/BuildUpdateStock";

export default class extends TestCase {
  beginMaterial: number;
  getName(): string {
    return '餐品模型'
  }
  protected buildActions(): BaseTest[] {
    return [
      new PreTest(),
      new Action({
        name: '增加餐品',
        url: '/app/product/addProduct',
        param: {
          name: '猪羊肉'
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
              "cnt": 20,
              "buyUnitFee": 1,
              "yieldRate": 0.5,
              "netCnt": 10,
              "stockBuyUnitFee": 1,
              "price": 2
            },
            {
              "materialId": '${materialMap.羊肉.materialId}',
              "cnt": 1,
              "buyUnitFee": 1,
              "yieldRate": 1,
              "netCnt": 1,
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
          name: '烤牛肉'
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
              "materialId": '${materialMap.牛肉.materialId}',
              "cnt": 5,
              "buyUnitFee": 1,
              "yieldRate": 0.8,
              "netCnt": 4,
              "stockBuyUnitFee": 1,
              "price": 2
            }

          ]
        }
      }),
      ... new BuildInventory({
        dayCnt: 20,
        defVal: 1000,
        defCost: 1000,
        nameArray: ['猪肉', '羊肉', '牛肉']
      }).getActions(),
      ... this.buildNote(19),

      ... this.buildNote(5, {
        needInstock: true
      }),
      ... this.buildNote(4, {
        needInstock: true
      }),
      ... this.buildNote(3, {
        needStatement: true
      }),
      ... this.buildNote(2, {
        needStatement: true
      }),
      ... this.buildNote(6, {
        needStatement: true
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
      ... this.buildNote(5),
      ... this.buildNote(19),
      this.buildImportProduct(),
      ... new BuildInventory({
        dayCnt: 1,
        defVal: 2,
        defCost: 2,
        nameArray: ['猪肉', '羊肉', '牛肉']
      }).getActions(),
      new Action({
        name: '全部计算',
        url: '/free/stateMaterial/recalStateMaterial',
        param: {
          warehouseId: '${warehouse.warehouseId}'

        }
      })
    ]
  }

  private buildImportProduct(): Action {
    return new Action({
      name: '上传销售记录',
      url: '/app/salesRecord/importSalesRecord',
      param: {
        datas: [
          ... this.buildDay(-8),
          ... this.buildDay(-6),
          ... this.buildDay(-4)
        ],
        warehouseId: '${warehouse.warehouseId}'
      }
    })
  }

  private buildDay(day: number): any[] {
    return [
      {
        product: {
          name: '猪羊肉',
          id: '${product.猪羊肉}'
        },
        salesRecord: {
          name: this.getDate(Math.abs(day))
        },
        cnt: {
          name: Math.abs(day)
        }
      },
      {
        product: {
          name: '烤牛肉',
          id: '${product.烤牛肉}'
        },
        salesRecord: {
          name: this.getDate(Math.abs(day))
        },
        cnt: {
          name: Math.abs(day)
        }
      }
    ]
  }

  private getDate(day: number): number {
    let date = new Date();
    date = DateUtil.beforeDay(date, day);
    console.log('date', DateUtil.format(date));
    let ret = DateUtil.toExcelDateNum(date);
    console.log('ret', ret);
    return ret;
  }

  private buildNote(day: number, opt?: {
    needInstock?: boolean;
    needStatement?: boolean;
  }): BaseTest[] {
    let names = ['猪肉', '羊肉', '牛肉']
    let price = 1;
    let cnt = 10
    let buyUnitFee = 1;

    let ret: BaseTest[] = [];
    let items: any[] = [];
    for (let i = 0; i < names.length; i++) {
      let name = names[i]
      items.push({
        "materialId": `\${materialMap.${name}.materialId}`,
        "supplierId": '${supplierMap.供应商1}',
        "cnt": cnt,
        "buyUnitFee": buyUnitFee,
        "stockUnitsId": 0,
        "price": price,
        "stockBuyUnitFee": 1
      })
    }

    ret.push(new Action({
      name: `下单物料`,
      url: '/app/note/createNote',
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
      ret.push(new BatchProcessNote({
        action: 'instock'
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
    ret.push(
      ... new BuildUpdateStock({
        dayCnt: day,
        tables: ['stockRecord', 'note', 'noteItem']
      }).getActions()
    )
    return ret;
  }

}
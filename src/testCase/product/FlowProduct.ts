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
    return '餐品模型'
  }
  protected buildActions(): BaseTest[] {
    return [
      ... new PreTest().getActions(),
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
              "price": 8
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
              "price": 8
            },
            {
              "materialId": '${materialMap.白菜.materialId}',
              "cnt": 10,
              "buyUnitFee": 1,
              "yieldRate": 0.5,
              "netCnt": 0.5,
              "stockBuyUnitFee": 1,
              "price": 8
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
              "price": 8
            },



          ]
        }
      }),

      ... this.buildNote(7),
      ... this.buildNote(7, {
        needInstock: true,
        cnt: 30,
        buyUnitFee: -10
      }),

      ... this.buildNote(7, {
        handInstock: true,
        supplier: '供应商2'
      }),
      ... this.buildNote(7, {
        needStatement: true,
        supplier: '供应商2'
      }),


      ... this.buildBack(6),


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
      ... new BuildInventory({
        dayCnt: 1,
        defVal: 10,
        nameArray: ['猪肉', '白菜', '鸡蛋']
      }).getActions(),
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
        name: '根据分类统计',
        url: '/app/state/analyseCategory',
        param: {
          "warehouseId": '${warehouse.warehouseId}',

          "begin": StrDateUtil.beforeDay(7),
          "end": DateUtil.todayStr()
        }
      }, {
        check(result) {
          let content = result?.result?.content;
          CheckUtil.expectEqualArray(content, [
            {
              "categoryId": 1783,
              "useAmount": 780,
              "backAmount": 200,
              "endAmount": 20,
              "handInstockAmount": 200,
              "instockAmount": 800,
              "otherUseAmount": 0,
              "salesAmount": 720,
              "openingAmount": 0,
              "buyUnitFee": 1,
              "name": "肉类"
            },
            {
              "categoryId": 1784,
              "useAmount": 780,
              "backAmount": 200,
              "endAmount": 20,
              "handInstockAmount": 200,
              "instockAmount": 800,
              "otherUseAmount": 0,
              "salesAmount": 360,
              "openingAmount": 0,
              "buyUnitFee": 1,
              "name": "蛋类"
            },
            {
              "categoryId": 1785,
              "useAmount": 780,
              "backAmount": 200,
              "endAmount": 20,
              "handInstockAmount": 200,
              "instockAmount": 800,
              "otherUseAmount": 0,
              "salesAmount": 360,
              "openingAmount": 0,
              "buyUnitFee": 1,
              "name": "蔬菜"
            }
          ], {
            notCheckCols: ['categoryId']
          })
        }
      })
    )
    ret.push(new Action({
      name:'根据供应商检查',
      url: '/app/state/analyseSupplier',
      param: {
        "warehouseId": '${warehouse.warehouseId}',

        "begin": StrDateUtil.beforeDay(7),
        "end": DateUtil.todayStr()

      }
    }, {
      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqualArray(content, [
          {
            "supplierId": 2617,
            "useAmount": 1200,
            "backAmount": 600,
            "endAmount": 0,
            "handInstockAmount": 0,
            "instockAmount": 1800,
            "otherUseAmount": 0,
            "salesAmount": 1120,
            "openingAmount": 0,
            "buyUnitFee": 1,
            "name": "供应商1"
          },
          {
            "supplierId": 2618,
            "useAmount": 1140,
            "backAmount": 0,
            "endAmount": 60,
            "handInstockAmount": 600,
            "instockAmount": 600,
            "otherUseAmount": 0,
            "salesAmount": 320,
            "openingAmount": 0,
            "buyUnitFee": 1,
            "name": "供应商2"
          }
        ], {
          notCheckCols: ['supplierId']
        })
      }
    }))
    return ret;
  }

  private buildImportProduct(): Action {
    return new Action({
      name: '上传销售记录',
      url: '/app/salesRecord/importSalesRecord',
      param: {
        datas: [
          ... this.buildDay(-5, 10),
          ... this.buildDay(-4, 6),
          ... this.buildDay(-3, 2)
        ],
        warehouseId: '${warehouse.warehouseId}'
      }
    })
  }

  private buildDay(day: number, cnt: number): any[] {
    return [
      {
        product: {
          name: '红烧肉',
          id: '${product.红烧肉}'
        },
        salesRecord: {
          name: this.getDate(Math.abs(day))
        },
        cnt: {
          name: cnt
        }
      },
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

  }): BaseTest[] {
    let names = ['猪肉', '白菜', '鸡蛋']
    let price = 2;
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
import { ArrayUtil, BaseTest, CheckUtil, DateUtil, StrDateUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";
import PreNote from "../PreNote";
import BuildInventory from "../../action/case/BuildInventory";
import BuildUpdateStock from "../../action/case/BuildUpdateStock";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import SaveShareData from "../../action/shareData/SaveShareData";
export default class extends TestCase {
  beginMaterial: number;
  getName(): string {
    return '成本分析补充'
  }


  private buildProductAndBom() {
    return [
      ... this.doBuildProductAndBom('番茄炒蛋', ['鸡蛋', '番茄'], {
        price: 10,
        stockBuyUnitFee: -10
      }),
      ... this.doBuildProductAndBom('羊肉炖茄子', ['羊肉', '茄子'], {
        price: 2,
        stockBuyUnitFee: 2
      }),
      ... this.doBuildProductAndBom('东坡肉', ['猪肉'], {
        price: 0.5,
        stockBuyUnitFee: 1
      }),

      ... this.doBuildProductAndBom('猪肉炖双蛋', ['鸡蛋', '鸭蛋', '猪肉'], {
        price: 2,
        stockBuyUnitFee: 2
      }),

    ]
  }

  private doBuildProductAndBom(productName: string,
    materials: string[],
    price?: {
      price: number;
      stockBuyUnitFee: number;
    }

  ): BaseTest[] {
    if (price == null) {
      price = {
        stockBuyUnitFee: -10,
        price: 10
      }
    }
    let boms = []
    for (let material of materials) {
      boms.push({
        materialId: '${materialMap.' + material + '.materialId}',
        cnt: 10,
        buyUnitFee: 1,
        yieldRate: 0.8,
        netCnt: 8,
        ...price
      })
    }
    return [
      new Action({
        name: '增加餐品',
        url: '/app/product/addProduct',
        param: {
          name: productName
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
          boms
        }
      })
    ]
  }

  private getMaterials(): any[] {
    return [
      { name: '茄子', category: '蔬菜' },
      { name: '番茄', category: '蔬菜' },
      { name: '白菜', category: '蔬菜' },
      { name: '羊肉', category: '肉类' },
      { name: '猪肉', category: '肉类' },
      { name: '鸡蛋', category: '蛋类' },
      { name: '鸭蛋', category: '蛋类' }
    ]
  }
  /**
   * 
   * @returns 
   */
  protected buildActions(): BaseTest[] {
    let materials = this.getMaterials();
    let ret: BaseTest[] = [
      ... new PreTest({
        materialsOpts: materials
      }).getActions(),
      //... this.buildProductAndBom()
    ]


    ret.push(... this.buildNotes(7, { cnt: 400, needInstock: true, supplier: '供应商1' }))
    ret.push(... this.buildBack(6, { cnt: 100 }))
    ret.push(... this.buildNotes(5, { cnt: 300, handInstock: true, supplier: '供应商1' }))


    ret.push(... this.buildNotes(3, { cnt: 400, needInstock: true, supplier: '供应商2', names: ['茄子', '番茄'] }))
    ret.push(... this.buildBack(2, { cnt: 100 }))
    ret.push(... this.buildNotes(1, { cnt: 300, handInstock: true, supplier: '供应商2', names: ['茄子', '番茄'] }))


    ret.push(new Action({
      name: '物料统计【by material】',
      url: '/app/note/listInstock',
      param: {
        "warehouseId": '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(7),
        end: StrDateUtil.beforeDay(1),
        "categoryId": '${categoryMap.肉类}',
      }
    }, {
      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqualArray(content, [
          {
            "materialId": 35725,
            "name": "羊肉",
            "cost": 600
          },
          {
            "materialId": 35726,
            "name": "猪肉",
            "cost": 600
          }
        ], {
          notCheckCols: ['materialId']
        })
      }
    }))

    ret.push(new Action({
      name: '物料统计【by supplier】',
      url: '/app/note/listInstock',
      param: {
        "warehouseId": '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(7),
        end: StrDateUtil.beforeDay(1),
        "supplierId": '${supplierMap.供应商2}'
      }
    }, {
      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqualArray(content, [
          {
            "materialId": 35736,
            "name": "茄子",
            "cost": 600
          },
          {
            "materialId": 35737,
            "name": "番茄",
            "cost": 600
          }
        ], {
          notCheckCols: ['materialId']
        })
      }
    }))

    ret.push(new AddWarehouse({
      name: '新供应商',
      variableType: 'supplierWarehouse',
      type: 'supplier'

    }));

    ret.push(... this.buildNotes(4, { cnt: 125, supplier: '供应商2', names: ['鸡蛋', '鸭蛋'] }))
    ret.push(new SaveShareData({
      data: {
        noteId: "${note.noteId}"
      }
    }))

    ret.push(new Action({
      url: '/app/note/linkNote',
      name: '接单',
      param: {
        warehouseId: "${supplierWarehouse.warehouseId}",
        _shareDataNo: "${shareDataNo}",
      }

    }, {
      warehouseType: 'supplierWarehouse'
    }))


    ret.push(
      new Action({
        name: '补充入库',
        url: '/app/note/addInstock',
        param: {

          noteId: '${note.noteId}',
          instockTime: StrDateUtil.beforeDay(4)
        }
      })
    )

    ret.push(
      new Action({
        name: '执行定时任务',
        url: '/app/timeServer/runTimeServer',
        param: {
          warehouseId: '${warehouse.warehouseId}',

        }
      })
    )

    ret.push(new Action({
      name: '物料统计【by category】',
      url: '/app/note/listInstock',
      param: {
        "warehouseId": '${warehouse.warehouseId}',
        begin: StrDateUtil.beforeDay(4),
        end: StrDateUtil.beforeDay(4),
        "categoryId": '${categoryMap.蛋类}',
      }
    }, {
      check(result) {
        let content = result.result.content;
        CheckUtil.expectEqualArray(content,
          [
            {
              "materialId": 35755,
              "name": "鸡蛋",
              "cost": 125
            },
            {
              "materialId": 35756,
              "name": "鸭蛋",
              "cost": 125
            }
          ]
          , {
            notCheckCols: ['materialId']
          })
      }
    }))

    ret.push(new Action({
      name: '检查订单',
      url: '/app/note/listNote',
      param: {
        warehouseId: '${warehouse.warehouseId}',
      }
    }, {
      check(result) {
        let content: any[] = result.result.content;
        let today = content.filter(row => row.instockTime == DateUtil.todayStr())

        let fourDay = content.filter(row => row.instockTime == StrDateUtil.beforeDay(4))
        CheckUtil.expectEqual(today.length, content.length - 1)
        CheckUtil.expectEqual(fourDay.length, 1)
      }
    }))


    return ret;
  }

  private buildNotes(day: number, opt?: {
    names?: string[],
    cnt?: number,
    needInstock?: boolean,
    needStatement?: boolean;
    handInstock?: boolean
    supplier?: string
  }) {
    let ret: BaseTest[] = []
    let names = opt?.names ?? this.getMaterials().map(row => row.name)
    let cnt = opt?.cnt ?? 100;
    let noteOpt = {
      needStatement: opt.needStatement,
      handInstock: opt.handInstock,
      needInstock: opt?.needInstock,
      cnt,
      buyUnitFee: 1,
      price: 1,
      yieldRate: 0.8,
      stockBuyUnitFee: 1,
      names,
      supplier: opt?.supplier
    }
    ret.push(... this.buildNote(day, noteOpt))


    return ret
  }

  private buildImportProduct(): Action {
    let days = []

    days.push(... this.buildDay(6, 2))
    days.push(... this.buildDay(5, 3))
    days.push(... this.buildDay(4, 5))

    return new Action({
      name: '上传销售记录',
      url: '/app/salesRecord/importSalesRecord',
      param: {
        datas: days,
        warehouseId: '${warehouse.warehouseId}'
      }
    })
  }

  private buildBack(day: number, opt?: { cnt?: number }) {

    let ret: BaseTest[] = [];
    let variable = this.getVariable()
    ret.push(new Action({
      name: '退货',
      url: '/app/noteBack/createNoteBack',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      parseHttpParam(param) {
        let noteItems: any[] = variable.noteItems;
        param.items = noteItems.map(row => ({

          "cnt": opt?.cnt ?? 100,
          "buyUnitFee": row.buyUnitFee,
          "price": row.price,
          "noteItemId": row.noteItemId,
          "supplierId": row.supplierId,
          "materialId": row.materialId,
          "stockBuyUnitFee": row.stockBuyUnitFee,
          "stockUnitsId": row.stockUnitsId
        }))
        return param;
      },
    }))
    ret.push(
      ... new BuildUpdateStock({
        dayCnt: day,
        tables: ['stockRecord', 'note', 'noteItem']
      }).getActions()
    )
    return ret;
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
      }, {
        product: {
          name: '红烧肉',
          id: '${product.红烧肉}'
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
          name: '东坡肉',
          id: '${product.东坡肉}'
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



  private buildNote(day: number, opt?: {

    needInstock?: boolean;
    needStatement?: boolean;
    handInstock?: boolean
    supplier?: string
    cnt?: number
    buyUnitFee?: number
    price?: number;
    instockCnt?: number;
    yieldRate?: number;
    names?: string[]
    stockBuyUnitFee?: number
  }): BaseTest[] {
    return new PreNote({
      ...opt,
      day,
      needNoteItems: true
    }).getActions();
  }

}
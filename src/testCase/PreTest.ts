import { ArrayUtil, BaseTest, IBaseTestOpt, TestCase } from "testflow";
import AddMaterial from "../action/material/AddMaterial";
import UpdateMaterial from "../action/material/UpdateMaterial";
import AddSupplier from "../action/supplier/AddSupplier";
import ListSupplier from "../action/supplier/ListSupplier";
import FindLastUserId from "../action/user/FindLastUserId";
import GetOpenId from "../action/user/GetOpenId";
import AddWarehouse from "../action/warehouse/AddWarehouse";
import ListMaterial from "../action/material/ListMaterial";
import Action from "../action/Action";
import ChangeWarehouse from "../action/user/ChangeWarehouse";

/**
 * 自定义物料：创建时必须带上初始单位（如「克」「包」），
 * 之后若要变成多级规格，需走 /app/material/saveBuyUnit（老单位必须保留在新规格中）。
 */
export interface MaterialsOpt {
  name: string;
  category: '肉类' | '蛋类' | '蔬菜'
  /** 创建时的初始单位名；不传则默认「斤」 */
  unit?: string
  /** 完整 buyUnit，优先于 unit */
  buyUnit?: any[]
  suppliers?: any[]
  /** 物料编码 */
  code?: string
}

interface Opt extends IBaseTestOpt {
  materialsOpts?: MaterialsOpt[];
}

/**
 * - 创建了 餐厅、供应商、物料
 * - 没有供应商账号和订单
 */
export default class extends TestCase {

  private preOpt: Opt;
  constructor(opt?: Opt) {
    super(opt);
    this.preOpt = opt
  }
  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId(),
      new GetOpenId(),
      new AddWarehouse(),
      new ChangeWarehouse(),
      new AddSupplier('供应商1'),
      new AddSupplier('供应商2'),
      this.buildAddCategory('肉类'),
      this.buildAddCategory('蛋类'),
      this.buildAddCategory('蔬菜'),
      new Action({
        name: '查询分类',
        url: '/app/category/listCategory',
        param: {}
      }, {
        buildVariable(result) {
          let content = result.result.content;
          return {
            categoryMap: ArrayUtil.toMapByKey(content, 'name', 'categoryId')
          }
        }
      }),
      new ListSupplier(),
      ... this.buildMaterials(),
      new ListMaterial()
    ]
  }

  private buildMaterials(): BaseTest[] {
    let materialOpts = this.preOpt?.materialsOpts;
    if (materialOpts != null && materialOpts.length > 0) {
      let ret: BaseTest[] = []
      for (let opt of materialOpts) {
        ret.push(
          new AddMaterial(opt.name, {
            buyUnit: opt.buyUnit ?? [
              { name: opt.unit ?? '斤' }
            ],
            categoryId: '${categoryMap.' + opt.category + '}',
            suppliers: opt.suppliers,
            code: opt.code
          })
        )
      }
      return ret;
    }
    return [
      new AddMaterial('猪肉', {
        buyUnit: [
          { "name": "瓶" }, { "name": "箱", isSupplier: true, fee: 10 }
        ],
        categoryId: '${categoryMap.肉类}'
      }),
      new AddMaterial('羊肉', { categoryId: '${categoryMap.肉类}' }),
      new UpdateMaterial('羊肉', { categoryId: '${categoryMap.肉类}' }),
      new AddMaterial('牛肉', {
        categoryId: '${categoryMap.肉类}',
        suppliers: [
          {
            "isDef": true,
            "supplierId": "${supplierMap.供应商2}",
            "price": 10
          }]
      }),
      new AddMaterial('鸡蛋', { categoryId: '${categoryMap.蛋类}' }),
      new AddMaterial('白菜', { categoryId: '${categoryMap.蔬菜}' }),
    ]
  }

  getName(): string {
    return '数据初始化'
  }

  needInScreen(): boolean {
    return false;
  }

  private buildAddCategory(name: string) {
    return new Action({
      name: '新增分类：' + name,
      url: '/app/category/addCategory',
      param: {
        name
      }
    })
  }
}

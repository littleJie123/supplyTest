import { BaseTest, TestCase } from "testflow";
import Action from "../../action/Action";
import PreTest from "../PreTest";

export default class extends TestCase {
  getName(): string {
    return '最大编码提示'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        materialsOpts: [
          { name: '猪肉', category: '肉类', code: 'A001' },
          { name: '羊肉', category: '肉类', code: 'A003' },
          { name: '白菜', category: '蔬菜', code: 'B002' }
        ]
      }).setRemark('准备品牌、分类和三条物料编码，覆盖“同分类不同尾号”和“不同分类”两类数据'),

      new Action({
        name: '查询肉类分类最大编号',
        url: '/app/material/findMaxCode',
        param: {
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          categoryId: '${categoryMap.肉类}'
        }
      }).setRemark('验证肉类分类下最大编号应为 3；返回值只保留编号尾号，不展示分类名称之外的编码前缀'),

      new Action({
        name: '查询全量最大编号',
        url: '/app/material/findMaxCode',
        param: {
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }).setRemark('验证不传 categoryId 时，按当前品牌全部物料统计，最大编号仍为 3；返回值中 name 为空')
    ]
  }
}

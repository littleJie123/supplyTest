import { BaseTest, CheckUtil, TestCase } from "testflow";
import Action from "../../action/Action";
import PreTest from "../PreTest";

class ErrorAction extends Action {
  protected checkHttpStatus(): void {
  }
}

export default class extends TestCase {
  getName(): string {
    return '不同分类物料编码重复';
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        materialsOpts: [
          { name: '猪肉', category: '肉类', code: 'MAT001' }
        ]
      }).setRemark('创建肉类物料猪肉，使用编码MAT001作为已存在的编码'),

      new ErrorAction({
        name: '新增不同分类的重复编码物料',
        url: '/app/material/SaveMaterial',
        param: {
          name: '白菜',
          code: 'MAT001',
          category: {
            categoryId: '${categoryMap.蔬菜}',
            name: '蔬菜'
          },
          buyUnit: [{ name: '斤', isSupplier: true, fee: 1 }],
          img: [],
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          const message = result?.error?.message ?? result?.message ?? '';
          CheckUtil.expectEqual(message, '肉类的猪肉已经使用该编码');
        }
      }).setRemark('肉类和蔬菜分类不同，但编码相同仍应报错，并提示已存在的分类和物料名称')
    ];
  }
}

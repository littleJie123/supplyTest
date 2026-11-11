import { BaseTest, CheckUtil, TestCase } from "testflow";
import Action from "../../action/Action";
import CheckArray from "../../action/CheckArray";
import AddMaterial from "../../action/material/AddMaterial";
import PreTest from "../PreTest";

/** 与 IsDelUtil.S_OnDelProduct 一致：随餐品删除的 BOM */
const BOM_ON_DEL_PRODUCT = 3;
/** 单条 BOM：cnt=10、buyUnitFee=1、price=2、stockBuyUnitFee=1，成本 20 */
const ONE_BOM_COST = 20;
const TWO_BOM_COST = 40;

/**
 * /app/product/listDelProduct、/app/product/restoreDelProduct
 * 删除后出现在已删除列表；恢复餐品，以及物料仍在的 BOM。
 * 同名同规格不能恢复。物料已删除的 BOM 保持 isDel=S_OnDelProduct。
 * 恢复物料时，同名未删除物料存在则拒绝恢复。
 */
export default class extends TestCase {
  constructor() {
    super({
      remark: '餐品删除后可查询、可恢复；同名同规格拒绝恢复；物料已删的 BOM 不恢复；恢复物料时同名拒绝'
    })
  }

  getName(): string {
    return '餐品删除与恢复'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest(),
      ...buildFullRestore(),
      ...buildOtherScale(),
      ...buildSameName(),
      ...buildMaterialDeleted(),
      ...buildMaterialNameRepeat()
    ]
  }
}

function buildFullRestore(): BaseTest[] {
  const name = '宫保鸡丁';
  const scaleName = '中份';
  return [
    addProduct(name, scaleName, 'fullProductId'),
    saveBom('fullProductId', ['猪肉', '白菜']),
    listAlive(name, scaleName, {
      title: '删除前能查到餐品',
      cost: TWO_BOM_COST
    }),
    delProduct('fullProductId', '删除宫保鸡丁'),
    listAlive(name, scaleName, {
      title: '删除后有效列表没有该餐品',
      missing: true
    }),
    listDeleted(name, scaleName, {
      title: '已删除列表能查到餐品',
      deleted: true
    }),
    checkBom('fullProductId', BOM_ON_DEL_PRODUCT, 2, '两条BOM都标成随餐品删除'),
    listBom('fullProductId', '删除后有效BOM为空', (content) => {
      CheckUtil.expectEqual(content.length, 0, '删除后 listBom 应为 0 条，实际=' + content.length)
    }),
    restoreProduct('fullProductId', '恢复宫保鸡丁'),
    listAlive(name, scaleName, {
      title: '恢复后有效列表能查到餐品',
      cost: TWO_BOM_COST
    }),
    listDeleted(name, scaleName, {
      title: '恢复后已删除列表没有该餐品',
      deleted: false
    }),
    checkBom('fullProductId', BOM_ON_DEL_PRODUCT, 0, '恢复后没有随餐品删除的BOM'),
    listBom('fullProductId', '两条BOM都恢复', (content) => {
      CheckUtil.expectEqual(content.length, 2, '应恢复猪肉和白菜两条BOM，实际=' + content.length)
      CheckUtil.expectEqual(content.filter(row => row.name == '猪肉' || row.name == '白菜').length, 2, '恢复的BOM应为猪肉和白菜')
    })
  ]
}

function buildOtherScale(): BaseTest[] {
  const name = '回锅肉';
  return [
    addProduct(name, '大份', 'bigProductId'),
    delProduct('bigProductId', '删除回锅肉大份'),
    addProduct(name, '小份', 'smallProductId'),
    restoreProduct('bigProductId', '不同规格可以恢复'),
    listAlive(name, '大份', { title: '大份已恢复' }),
    listAlive(name, '小份', { title: '小份仍在' })
  ]
}

function buildSameName(): BaseTest[] {
  const name = '回锅肉';
  const scaleName = '大份';
  return [
    delProduct('bigProductId', '再次删除回锅肉大份'),
    addProduct(name, scaleName, 'liveBigProductId'),
    new Action({
      name: '同名同规格不能恢复',
      remark: '已有未删除的回锅肉大份，再恢复原来的大份应失败',
      url: '/app/product/restoreDelProduct',
      exceptHttpStatus: 500,
      param: {
        productId: '${bigProductId}'
      }
    }, {
      check(result) {
        let message = result?.error?.message ?? ''
        CheckUtil.expectEqual(
          String(message).includes('名称和规格不能重复'),
          true,
          '应提示名称和规格不能重复，实际=' + message
        )
      }
    }),
    listAlive(name, scaleName, { title: '新的大份仍在' }),
    listDeleted(name, scaleName, {
      title: '原来的大份仍是已删除',
      deleted: true
    })
  ]
}

function buildMaterialDeleted(): BaseTest[] {
  const name = '鱼香肉丝';
  const scaleName = '';
  return [
    addProduct(name, scaleName, 'partProductId'),
    saveBom('partProductId', ['猪肉', '白菜']),
    delProduct('partProductId', '删除鱼香肉丝'),
    new Action({
      name: '删除白菜',
      remark: '餐品已删除后再删物料，这条BOM保持随餐品删除',
      url: '/app/material/delMaterial',
      param: {
        materialId: '${materialMap.白菜.materialId}'
      }
    }),
    restoreProduct('partProductId', '恢复鱼香肉丝'),
    listAlive(name, scaleName, {
      title: '鱼香肉丝已恢复',
      cost: ONE_BOM_COST
    }),
    listBom('partProductId', '只恢复猪肉BOM', (content) => {
      CheckUtil.expectEqual(content.length, 1, '物料已删时只应恢复猪肉，实际=' + content.length)
      CheckUtil.expectEqual(content[0]?.name, '猪肉', '恢复的BOM应是猪肉，实际=' + content[0]?.name)
    }),
    checkBom('partProductId', BOM_ON_DEL_PRODUCT, 1, '白菜BOM仍是随餐品删除')
  ]
}

function buildMaterialNameRepeat(): BaseTest[] {
  return [
    new AddMaterial('白菜', {
      categoryId: '${categoryMap.蔬菜}',
      code: 'BAICAI2'
    }).setRemark('原来的白菜已删除，可以再加一条同名物料'),
    new Action({
      name: '同名物料不能恢复',
      remark: '已有未删除的白菜，再恢复原来的白菜应失败',
      url: '/app/material/restoreMaterial',
      exceptHttpStatus: 500,
      param: {
        materialId: '${materialMap.白菜.materialId}'
      }
    }, {
      check(result) {
        let message = result?.error?.message ?? ''
        CheckUtil.expectEqual(
          String(message).includes('物料名称不能重复'),
          true,
          '应提示物料名称不能重复，实际=' + message
        )
      }
    }),
    checkMaterial('白菜', 0, 1, '新的白菜仍在'),
    checkMaterial('白菜', 1, 1, '原来的白菜仍是删除状态')
  ]
}

function addProduct(name: string, scaleName: string, varName: string): BaseTest {
  let label = scaleName == '' ? name : name + scaleName
  return new Action({
    name: '增加餐品' + label,
    url: '/app/product/addProduct',
    param: {
      name,
      scaleName,
      unitsName: '份',
      price: 0
    }
  }, {
    buildVariable(result) {
      return {
        [varName]: result.result.productId
      }
    }
  })
}

function saveBom(productVar: string, materials: string[]): BaseTest {
  return new Action({
    name: '保存' + productVar + '的BOM',
    url: '/app/bom/saveBom',
    param: {
      productId: '${' + productVar + '}',
      boms: materials.map(materialName => ({
        materialId: '${materialMap.' + materialName + '.materialId}',
        cnt: 10,
        buyUnitFee: 1,
        yieldRate: 1,
        netCnt: 10,
        price: 2,
        stockBuyUnitFee: 1
      }))
    }
  })
}

function delProduct(productVar: string, name: string): BaseTest {
  return new Action({
    name,
    url: '/app/product/delProduct',
    param: {
      productId: '${' + productVar + '}'
    }
  })
}

function restoreProduct(productVar: string, name: string): BaseTest {
  return new Action({
    name,
    url: '/app/product/restoreDelProduct',
    param: {
      productId: '${' + productVar + '}'
    }
  })
}

function listAlive(name: string, scaleName: string, opt: {
  title: string
  missing?: boolean
  cost?: number
}): BaseTest {
  return new Action({
    name: opt.title,
    url: '/app/product/listProduct',
    param: {
      keyword: name
    }
  }, {
    check(result) {
      assertProduct(contentOf(result), name, scaleName, opt)
    }
  })
}

function listDeleted(name: string, scaleName: string, opt: {
  title: string
  deleted: boolean
}): BaseTest {
  return new Action({
    name: opt.title,
    url: '/app/product/listDelProduct',
    param: {
      keyword: name
    }
  }, {
    check(result) {
      let row = findProduct(contentOf(result), name, scaleName)
      if (opt.deleted) {
        CheckUtil.expectEqual(row != null, true, name + scaleName + '应在已删除列表')
        CheckUtil.expectEqual(Number(row.isDel) != 0, true, 'isDel 应不为 0，实际=' + row.isDel)
      } else {
        CheckUtil.expectEqual(row == null, true, name + scaleName + '不应在已删除列表')
      }
    }
  })
}

function listBom(productVar: string, name: string, check: (content: any[]) => void): BaseTest {
  return new Action({
    name,
    url: '/app/bom/listBom',
    param: {
      productId: '${' + productVar + '}'
    }
  }, {
    check(result) {
      check(contentOf(result))
    }
  })
}

function checkMaterial(name: string, isDel: number, count: number, remark: string): BaseTest {
  return new CheckArray([{
    table: 'material',
    query: {
      name,
      isDel
    },
    check(array) {
      CheckUtil.expectEqual(array.length, count, remark + '，实际=' + array.length)
    }
  }]).setRemark(remark)
}

function checkBom(productVar: string, isDel: number, count: number, remark: string): BaseTest {
  return new CheckArray([{
    table: 'bom',
    query: {
      productId: '${' + productVar + '}',
      isDel
    },
    check(array) {
      CheckUtil.expectEqual(array.length, count, remark + '，实际=' + array.length)
    }
  }]).setRemark(remark)
}

function contentOf(result: any): any[] {
  return result?.result?.content ?? []
}

function findProduct(list: any[], name: string, scaleName: string) {
  return list.find(row => row.name == name && (row.scaleName ?? '') == scaleName)
}

function assertProduct(list: any[], name: string, scaleName: string, opt: {
  missing?: boolean
  cost?: number
}) {
  let row = findProduct(list, name, scaleName)
  if (opt.missing) {
    CheckUtil.expectEqual(row == null, true, name + scaleName + '不应出现在有效列表')
    return
  }
  CheckUtil.expectEqual(row != null, true, name + scaleName + '应出现在有效列表')
  if (opt.cost != null) {
    CheckUtil.expectEqual(Number(row.cost), opt.cost, name + '成本应为' + opt.cost + '，实际=' + row.cost)
  }
}

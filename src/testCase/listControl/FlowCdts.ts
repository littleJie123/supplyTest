import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";

/**
 * 校验 ListControl 通用查询条件 cdts（见 doc/ListControl查询条件.md）。
 * 接口：/app/material/listMaterialByCategory
 */
export default class extends TestCase {
  constructor() {
    super({
      remark: 'ListControl.cdts：listMaterialByCategory 覆盖 = / like / in / or / and / 嵌套，及名字或拼音首字母'
    })
  }

  getName(): string {
    return 'ListControl通用查询cdts'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        remark: '前置：仓库/分类/物料（猪羊牛、鸡蛋、白菜）'
      }),

      new Action({
        remark: 'cdts：name=羊肉（默认=）',
        name: 'cdts等值查询',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: {
            array: [
              { col: 'name', value: '羊肉' }
            ]
          }
        }
      }, {
        check(result) {
          const names = toNames(result);
          CheckUtil.expectEqual(names.length, 1, `等值应只返回羊肉，实际=${JSON.stringify(names)}`);
          CheckUtil.expectEqual(names[0], '羊肉');
        }
      }),

      new Action({
        remark: 'cdts：name like 肉（无%自动补两侧%）',
        name: 'cdts like无百分号',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: {
            array: [
              { col: 'name', value: '肉', op: 'like' }
            ]
          }
        }
      }, {
        check(result) {
          const names = toNames(result);
          for (const expect of ['猪肉', '羊肉', '牛肉']) {
            CheckUtil.expectEqual(
              names.includes(expect),
              true,
              `like 肉 应包含${expect}，实际=${JSON.stringify(names)}`
            );
          }
          CheckUtil.expectEqual(
            names.includes('鸡蛋'),
            false,
            `like 肉 不应包含鸡蛋，实际=${JSON.stringify(names)}`
          );
          CheckUtil.expectEqual(
            names.includes('白菜'),
            false,
            `like 肉 不应包含白菜，实际=${JSON.stringify(names)}`
          );
        }
      }),

      new Action({
        remark: 'cdts：name like %肉%（已有%不改）',
        name: 'cdts like有百分号',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: {
            array: [
              { col: 'name', value: '%肉%', op: 'like' }
            ]
          }
        }
      }, {
        check(result) {
          const names = toNames(result);
          for (const expect of ['猪肉', '羊肉', '牛肉']) {
            CheckUtil.expectEqual(
              names.includes(expect),
              true,
              `like %肉% 应包含${expect}，实际=${JSON.stringify(names)}`
            );
          }
          CheckUtil.expectEqual(
            names.includes('鸡蛋'),
            false,
            `like %肉% 不应包含鸡蛋，实际=${JSON.stringify(names)}`
          );
        }
      }),

      new Action({
        remark: 'cdts：name like 肉%（仅右侧%，不自动再包）',
        name: 'cdts like仅右百分号',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: {
            array: [
              { col: 'name', value: '肉%', op: 'like' }
            ]
          }
        }
      }, {
        check(result) {
          const names = toNames(result);
          // 「肉%」匹配以「肉」开头，猪/羊/牛肉都不以「肉」开头
          CheckUtil.expectEqual(
            names.length,
            0,
            `like 肉% 不应命中猪羊牛，实际=${JSON.stringify(names)}`
          );
        }
      }),

      // 对齐 MaterialList.schCol=['name','firstPinyin']：名字或拼音首字母
      new Action({
        remark: '业务：按名字搜「羊」（name or firstPinyin like）→ 羊肉',
        name: 'cdts名字或首字母-按名字',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: nameOrFirstPinyinLike('羊')
        }
      }, {
        check(result) {
          const names = toNames(result);
          CheckUtil.expectEqual(names.length, 1, `按名字羊应只返回羊肉，实际=${JSON.stringify(names)}`);
          CheckUtil.expectEqual(names[0], '羊肉');
        }
      }),

      new Action({
        remark: '业务：按首字母搜「yr」（羊肉 firstPinyin=yr）→ 羊肉',
        name: 'cdts名字或首字母-按首字母',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: nameOrFirstPinyinLike('yr')
        }
      }, {
        check(result) {
          const names = toNames(result);
          CheckUtil.expectEqual(names.length, 1, `按首字母 yr 应只返回羊肉，实际=${JSON.stringify(names)}`);
          CheckUtil.expectEqual(names[0], '羊肉');
        }
      }),

      new Action({
        remark: '业务：按首字母搜「j」（鸡蛋 firstPinyin=jd）→ 鸡蛋',
        name: 'cdts名字或首字母-单字母',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: nameOrFirstPinyinLike('j')
        }
      }, {
        check(result) {
          const names = toNames(result);
          CheckUtil.expectEqual(
            names.includes('鸡蛋'),
            true,
            `按首字母 j 应含鸡蛋，实际=${JSON.stringify(names)}`
          );
          for (const unexpected of ['猪肉', '羊肉', '牛肉', '白菜']) {
            CheckUtil.expectEqual(
              names.includes(unexpected),
              false,
              `按首字母 j 不应含${unexpected}，实际=${JSON.stringify(names)}`
            );
          }
        }
      }),

      new Action({
        remark: '业务：按首字母搜「bc」（白菜）且不含肉类',
        name: 'cdts名字或首字母-白菜bc',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: nameOrFirstPinyinLike('bc')
        }
      }, {
        check(result) {
          const names = toNames(result);
          CheckUtil.expectEqual(names.length, 1, `按首字母 bc 应只返回白菜，实际=${JSON.stringify(names)}`);
          CheckUtil.expectEqual(names[0], '白菜');
        }
      }),

      new Action({
        remark: 'cdts：materialId in [羊肉,牛肉]（数组默认 in）',
        name: 'cdts in查询',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: {
            array: [
              {
                col: 'materialId',
                value: [
                  '${materialMap.羊肉.materialId}',
                  '${materialMap.牛肉.materialId}'
                ]
              }
            ]
          }
        }
      }, {
        check(result) {
          const names = toNames(result).sort();
          CheckUtil.expectEqual(
            JSON.stringify(names),
            JSON.stringify(['牛肉', '羊肉'].sort()),
            `in 应只返回羊/牛，实际=${JSON.stringify(names)}`
          );
        }
      }),

      new Action({
        remark: 'cdts 顶层 or：name=羊肉 or name=白菜',
        name: 'cdts顶层or',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: {
            op: 'or',
            array: [
              { col: 'name', value: '羊肉' },
              { col: 'name', value: '白菜' }
            ]
          }
        }
      }, {
        check(result) {
          const names = toNames(result).sort();
          CheckUtil.expectEqual(
            JSON.stringify(names),
            JSON.stringify(['白菜', '羊肉'].sort()),
            `顶层 or 应返回羊/白菜，实际=${JSON.stringify(names)}`
          );
        }
      }),

      new Action({
        remark: 'cdts 顶层 and：name like 肉 and materialId=羊肉',
        name: 'cdts顶层and',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: {
            op: 'and',
            array: [
              { col: 'name', value: '肉', op: 'like' },
              { col: 'materialId', value: '${materialMap.羊肉.materialId}' }
            ]
          }
        }
      }, {
        check(result) {
          const names = toNames(result);
          CheckUtil.expectEqual(names.length, 1, `and 应只返回羊肉，实际=${JSON.stringify(names)}`);
          CheckUtil.expectEqual(names[0], '羊肉');
        }
      }),

      new Action({
        remark: 'cdts 嵌套：like 肉 and (name=羊肉 or name=白菜) → 仅羊肉',
        name: 'cdts嵌套or/and',
        url: '/app/material/listMaterialByCategory',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          cdts: {
            op: 'and',
            array: [
              { col: 'name', value: '肉', op: 'like' },
              {
                op: 'or',
                array: [
                  { col: 'name', value: '羊肉' },
                  { col: 'name', value: '白菜' }
                ]
              }
            ]
          }
        }
      }, {
        check(result) {
          const names = toNames(result);
          CheckUtil.expectEqual(
            names.length,
            1,
            `嵌套 and+(or) 应只命中羊肉（白菜无「肉」），实际=${JSON.stringify(names)}`
          );
          CheckUtil.expectEqual(names[0], '羊肉');
        }
      }),
    ]
  }
}

function toNames(result: any): string[] {
  const content = result?.result?.content ?? [];
  return content.map((row: any) => row.name);
}

/** 对齐客户端 MaterialList：schCol = name / firstPinyin，同一关键字 OR like */
function nameOrFirstPinyinLike(keyword: string) {
  return {
    op: 'or',
    array: [
      { col: 'name', value: keyword, op: 'like' },
      { col: 'firstPinyin', value: keyword, op: 'like' }
    ]
  };
}

# 简介
测试 RecommendHat：按报货日/在途计算营业额窗口，得出推荐报货量 `recommentCnt`。

# 测试步骤
1. 引用 PreTest（初始化餐厅、供应商、物料）
2. `SaveMaterial` 新增「测试推荐报货」：每天报货、在途 0；安全库存 `cnt=10`
3. `listMaterialByCategory` 查出规格 unitsId
4. `updateMaterial` 写入千元用量 `dosageCnt=2`、`dosageUnitsId`
5. `saveTurnover` 保存今天营业额 1000、明天 2000
6. `listMaterialByCategory` 查询，期望 `recommentCnt.cnt=16`
7. `listMaterial4FastNote` 查询，期望同样 `recommentCnt.cnt=16`

# 注意点
- 每天报货 + 在途 0：下下次报货日=明天，下下次到货日=明天；营业额窗口为今天～明天
- 公式：`营业额累计/1000 * dosageCnt + 安全库存 - 当前库存` = `3000/1000*2 + 10 - 0 = 16`
- 有真实营业额时取 `realMoney`，否则取 `money`
- `orderType=supplier`（和供应商一样）时用供应商的报货日/在途；本用例直接在物料供应商关系上设 `day`
- 每个 Action 都有 remark；本流程每步仅 1 个接口调用，不包嵌套 TestCase

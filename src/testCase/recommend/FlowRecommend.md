# 简介
测试 RecommendHat 在动态报货日场景下的推荐报货量计算，覆盖按月、按周、按供应商跟随，以及 `needRoundUp` 的取整逻辑。

# 测试步骤
1. 引用 PreTest（初始化餐厅、供应商、物料）
2. `updateSupplier`：供应商1 改为按周报货，`orderDay` 按“今天 + 2 天”的星期几动态计算，`daysInTransit=0`
3. `SaveMaterial` 新增「青菜」：
   - `buyUnit`：`1包=10斤`（测试中按包为基础单位）
   - 供应商关系：按月报货，`orderDay` 按“今天 + 3 天”的日期动态计算，`daysInTransit=1`
   - 安全库存 `cnt=1`，千元用量 `dosageCnt=2`，当前库存 `2包`
4. `SaveMaterial` 新增「豆芽」：
   - 无报货日配置
   - 安全库存 `cnt=3`，`needRoundUp=1`，当前库存 `1.5包`
5. `SaveMaterial` 新增「西葫芦」：
   - 供应商关系 `orderType='supplier'`，跟随供应商1 的周报货
   - 安全库存 `cnt=4`，`needRoundUp=1`，当前库存 `0.5包`
6. `saveTurnover`：保存从今天起连续 30 天的营业额，每天 `2000`
7. `listMaterialByCategory` 查询，校验：
   - 青菜：按营业额窗口 `turnoverSum/1000*2 + 1 - 2`
   - 豆芽：无报货日时按安全库存减当前库存再取整
   - 西葫芦：跟随供应商周报货，按 `4 - 0.5` 取整
8. `listMaterial4FastNote` 查询，校验同样的 `recommentCnt`

# 注意点
- 报单日均按当前日期动态计算，不写死固定日期；`month` 取“今天 + 3 天”的日数，`week` 取“今天 + 2 天”的星期几。
- `RecommendHat` 的营业额窗口以“下下次到货日”为止，牛肉按月 `month`、在途 `1` 日，故窗口长度会随当前日期变化。
- `needRoundUp=1` 的场景必须按取整规则处理：猪肉和羊肉最终返回整数值。
- `orderType='supplier'` 时，`RecommendHat` 会强制读取供应商的 `orderType/orderDay/daysInTransit`；本用例验证“跟随供应商周报货”这一分支。
- 每个 Action 都有 `remark`；本流程每步仅 1 个接口调用，不包嵌套 TestCase。

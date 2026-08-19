# 简介
测试按日期删除盘点：7/1 手工入库 10 包牛肉后，7/2 盘成 2 包；删除 7/2 盘点并重算后，库存应回到入库后的 10 包。

# 测试步骤
1. **前置**：`PreTest` 仅创建牛肉（初始单位「包」）
2. **7月1日手工入库**：`createHandInstock`，牛肉 **10包 / 1000元**（`cnt=10, buyUnitFee=1`，100元/包），`salesDay=2026-07-01`；随后 `Recal`
3. **7月2日盘点**：`setInventoryByArray`，牛肉 **2包**（`cnt=2, buyUnitFee=1`）。盘点忽略输入成本，按入库批次单价回填
4. **重算后检查库存**：`Recal` → `CheckStock` 数量 2 包 → `CheckArray` 金额 200（盘亏 8 包，按 100元/包）
5. **删除7月2日盘点**：`delInventoryByInventoryDay`，`inventoryDay=2026-07-02`
6. **重算后检查库存**：`Recal` → `CheckStock` 数量 10 包 → `CheckArray` 金额 1000（回到 7/1 手工入库）

# 注意点
- 牛肉标准单位是包，按包操作 `buyUnitFee=1`
- 7/1 用手工入库（单接口），带 `salesDay=2026-07-01`；不要用盘点冒充入库
- 盘点 `calType=set`：已有批次时忽略输入成本，从最新批次往旧回填。此处仅 7/1 一批 10包/1000元，盘成 2 包后剩 2包/200元
- 删除会 `onDelInventory` 去掉当天盘点流水再 `recalByBeginStr`；两次检查库存前都要 `Recal`
- 校验步骤含 Recal + CheckStock + CheckArray，收成嵌套 TestCase；手工入库/盘点/删除都是单接口 Action

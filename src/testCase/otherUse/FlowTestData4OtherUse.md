# FlowTestData4OtherUse

为「其他消耗」准备盘点数据。物料与规格见 [`PreTestWithMeat`](../PreTestWithMeat.md)。

## 目的

在已有羊/牛/猪肉规格上做两次盘点，便于后续叠加其他消耗（OtherUse）用例。

## 测试步骤

1. **初始化**：`PreTestWithMeat`（羊肉/牛肉 1包=100克，猪肉为克）。
2. **盘点 2026-06-01**（cost = 克数 × 1 元）：
   - 牛肉：2包 → `{ cnt: 2, buyUnitFee: 1, cost: 200 }`（标准单位=包）
   - 羊肉：4包 → `{ cnt: 4, buyUnitFee: -100, cost: 400 }`（标准单位=克）
3. **盘点 2026-07-01**：
   - 牛肉：3包 → `{ cnt: 3, buyUnitFee: 1, cost: 300 }`
   - 羊肉：6包 → `{ cnt: 6, buyUnitFee: -100, cost: 600 }`
4. **重算库存**：`Recal`。
5. **校验库存**：`CheckStock` 与 7/1 一致；`CheckArray` 校验金额（牛肉 300、羊肉 600）。

## 规格说明

见 `PreTestWithMeat.md` 与 `supplychain/doc/buyUnitFee.md`。

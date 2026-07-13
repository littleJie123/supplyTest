# 入库后改价 / 改量 - 接口说明

1. 订单**已入库**后，可通过 `/app/note/updatePrice` 修改物料单价；也可**同时**修改单价与入库数量。服务端对应 `noteItemDomain.updateCntAndPrice`。
2. 订单**未入库** 只能修改价格，不能修改入库数量。
3. 订单 **已对账** 不能修改。

## 涉及接口

| 接口 | 说明 | 前端是否需要调用 |
|------|------|-------------|
| `/app/note/updatePrice` | 更新订单物料入库价格，可选同时更新入库数量 | **需要** |
| `/app/noteItem/listNoteItem` | 查询订单物料（改价前后校验） | 不需要 |
| `/app/note/listNote` | 查询订单汇总金额 | 不需要 |

## 使用场景

1. **只改价格**：用户修正入库单价，入库数量不变。
2. **改价格 + 改数量**：用户同时修正入库单价与实收数量（例如部分入库后调整）。
3. **重要**:修改价格填入的数量，必须是listNoteItem接口查出来的buyUnitFee下的数量（buyUnitFee不变），StockInp默认返回的buyUnitFee是不变的。

> 接口路径仍为 `updatePrice`，行为已扩展为可同时更新 `instockCnt`。

## 请求参数

```javascript
{
  warehouseId: 1,
  warehouseGroupId: 1,
  noteItems: [
    {
      noteItemId: 12345,      // 必填
      materialId: 100,        // 建议传，便于排查
      price: 25,              // 新单价
      stockBuyUnitFee: -10,   // 与 price 配套的单位系数，需与物料一致
      instockCnt: 20          // 可选；不传表示不改入库数量
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `noteItems[].noteItemId` | number | 是 | 订单物料 ID |
| `noteItems[].price` | number | 改价时必填 | 新采购单价 |
| `noteItems[].stockBuyUnitFee` | number | 改价时必填 | 价格单位系数，与下单/入库时一致 |
| `noteItems[].instockCnt` | number | 否 | 新入库数量；**不传则保持原入库数量** |

## 请求示例

### 示例 1：只改价格

猪肉原价 21，入库数量 400 不变，只把单价改为 25：

```javascript
{
  warehouseId: '${warehouseId}',
  warehouseGroupId: '${warehouseGroupId}',
  noteItems: [{
    noteItemId: 10001,
    materialId: 20001,
    price: 25,
    stockBuyUnitFee: -10
  }]
}
```

### 示例 2：同时改价格与入库数量

羊肉单价 0.2 → 0.25，入库数量 30 → 20：

```javascript
{
  warehouseId: '${warehouseId}',
  warehouseGroupId: '${warehouseGroupId}',
  noteItems: [{
    noteItemId: 10002,
    materialId: 20002,
    price: 0.25,
    stockBuyUnitFee: 500,
    instockCnt: 20
  }]
}
```

## 响应与校验

- 接口成功时无特殊返回体，前端可在保存后重新调用 `listNoteItem` 刷新明细。
- 订单汇总金额（`listNote` 的 `instockCost`）会随改价/改量重算。

### 本用例自动化验证点

| 步骤 | 操作 | 预期 |
|------|------|------|
| 供应商接单 | linkNote | 产生链接单，餐厅单 `linkNoteId` 有值 |
| 入库后 | — | 餐厅单/链接单 `instockCost = 846`；库存数量与金额正确 |
| 只改猪肉价 21→25 | 不传 `instockCnt` | 餐厅单/链接单 `instockCost=1006`；猪肉库存金额 1000；链接单 noteItem 同步 |
| 改羊肉价 0.2→0.25，量 30→20 | 传 `price` + `instockCnt` | 餐厅单/链接单 `instockCost=1005`；羊肉库存 cnt=20、cost=5；链接单 noteItem 同步 |

每次改价/改量后均会：先 `recal` 重算库存，再 `CheckStock` 校验数量，并校验 `stock` 表金额及链接单 noteItem。

## 前端注意事项

1. **改价必带 `stockBuyUnitFee`**，与物料采购单位一致，否则单价换算会错。
2. **只改价时不要传 `instockCnt`**（或传原值），避免误改数量。
3. **改量时 `instockCnt` 单位**与 `listNoteItem` 返回的 `instock.cnt` 一致（采购单位下的数量）。
4. 存在**链接单**时，服务端会同步 `linkInstockCnt`、`linkInstockCost`、`linkPrice`。测试比对时用 `StockUtil.isEq`（库存）和 `StockUtil.isEqPrice`（价格），字段映射见 `LinkNoteItemUtil`。

## 自动化测试

用例类：`FlowNoteUpdateCntAndPrice`（`supplyTest/src/testCase/note/FlowNoteUpdateCntAndPrice.ts`）

在 testflow 中选中「入库后改价改量」运行即可。

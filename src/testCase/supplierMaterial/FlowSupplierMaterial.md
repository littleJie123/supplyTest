# 采购单价定时 - 接口变更说明

允许为供应商物料设置「未来某日生效」的采购单价。前端在保存物料时提交定时价字段；查询物料列表时从 `supplierMaterial` 读取定时价及生效后的价格。

## 需要前端修改的地方
物料详情保存和新增接口发生改变。需要前端修改物料详情页面，支持用户在供应商的价格处录入日期（planPriceDate）以及生效价格(planPrice)。

## 涉及接口

| 接口 | 说明 |是否需要修改前端模块|
|------|------|----|
| `/app/material/SaveMaterial` | 新增物料 |需要|
| `/app/material/updateMaterial` | 保存/更新物料 |需要|
| `/app/material/listMaterialByCategory` | 按分类查询物料（验证保存结果） |<span style="color:#ff3333;">不需要</span>|

## 请求变更

`SaveMaterial`、`updateMaterial` 的 `suppliers[]` 每项在原有字段基础上，**新增可选字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `planPriceDate` | string | 指定生效日期，格式 `yyyy-MM-dd`；不传或空表示未设置定时价 |
| `planPrice` | number | 指定日期生效的采购单价；设置了 `planPriceDate` 时**必填** |

原有字段 `price` 仍表示**当前生效价**（未到指定日期时使用）。

### 新增物料 SaveMaterial

```javascript
{
  name: '测试定时价',
  warehouseId: 1,
  warehouseGroupId: 1,
  category: { categoryId: 100 },
  buyUnit: [{ isSupplier: true, name: '斤', fee: 1 }],
  suppliers: [{
    isDef: true,
    supplierId: 3777,
    price: 10,              // 当前生效价
    planPriceDate: '2026-07-10',  // 未来生效日期
    planPrice: 20,          // 到期后生效价
    moc: 0
  }]
}
```

### 保存物料 updateMaterial

```javascript
{
  materialId: 46386,
  name: '测试定时价',
  warehouseId: 1,
  warehouseGroupId: 1,
  category: { categoryId: 100 },
  buyUnit: [{ isSupplier: true, name: '斤', fee: 1 }],
  suppliers: [{
    isDef: true,
    supplierId: 3777,
    price: 10,
    planPriceDate: '2026-07-08',
    planPrice: 30
  }]
}
```

## 响应变更

`listMaterialByCategory` 返回的每条物料中，`supplierMaterial` **新增字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `planPriceDate` | string \| null | 指定生效日期 |
| `planPrice` | number \| null | 指定日期生效价 |

### listMaterialByCategory 输出示例

**未到期**（指定日期 > 今天）：仍用 `price`，定时价原样返回。

```javascript
{
  materialId: 46386,
  name: '测试定时价',
  supplierMaterial: {
    supplierMaterialId: 14308,
    supplierId: 3777,
    price: 10,
    planPriceDate: '2026-07-10',
    planPrice: 20,
    buyUnitFee: -1,
    stockUnitsId: 18,
    moc: 0
  }
}
```

**已到期**（指定日期 <= 今天）：服务端读时解析，`price` 返回生效后的 plan 价，`planPriceDate` / `planPrice` 为空。

```javascript
{
  materialId: 46386,
  name: '测试定时价',
  supplierMaterial: {
    supplierMaterialId: 14308,
    supplierId: 3777,
    price: 30,
    planPriceDate: null,
    planPrice: null,
    buyUnitFee: -1,
    stockUnitsId: 18,
    moc: 0
  }
}
```

## 前端注意事项

1. 编辑物料时，`suppliers[]` 需一并提交 `planPriceDate`、`planPrice`（有则传，无则传 null 或不传）。
2. 设置了 `planPriceDate` 必须同时设置 `planPrice`，否则服务端报错。
3. `planPriceDate` 格式必须为 `yyyy-MM-dd`。
4. 列表展示「即将生效价」时读 `planPriceDate` + `planPrice`；展示当前采购价读 `price`（已到期时 `price` 已是 plan 价）。
5. 到期生效为**读时解析**，数据库中的 `price` 不会自动更新，仅接口返回时会按规则解析。

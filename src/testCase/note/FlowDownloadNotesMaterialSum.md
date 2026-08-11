# 简介
验证 `/app/note/downloadNotes` 物料一览：同物料多订单、不同下单单位（瓶/箱）汇总后，`createNameByUnits` 数量正确（含跨日）。

# 测试步骤
1. 引用 PreTest
2. `/free/query` 查 `units`：`name in ['箱','瓶']`；`updateMaterial` 牛肉改为瓶→箱（`fee=5`）

## 场景1：当日混单位
3. `createNote` 牛肉 **4瓶** → `sendNote`
4. `createNote` 牛肉 **2箱**（`cnt=2,buyUnitFee=-5`）→ `sendNote`
5. `listNoteGroup`（NoteDay）当日 `noteCnt=2` → `saveShareData` → `downloadNotes` 物料一览  
   期望订货数量 **`14瓶`**（4+2×5）

## 场景2：前天瓶 + 昨天箱
6. `createNote` 牛肉 **3瓶** → `sendNote` → `listNoteGroup` → **`batchProcessNote` 入库** → **`updateNoteTime` 改到前天**
7. `createNote` 牛肉 **1箱** → `sendNote` → `listNoteGroup` → **`batchProcessNote` 入库** → **`updateNoteTime` 改到昨天**
8. `listNote` 取两单 `title`（sheet 名，`[]`→`()`）
9. `downloadNotes`（`noteId`=前天单）订单 sheet：订货数量 **`3瓶`**
10. `downloadNotes`（`noteId`=昨天单）订单 sheet：订货数量 **`1箱`**
11. `saveShareData`：`groupType=NoteMonth`，`status=instocked`，`begin=前天`，`end=昨天` → `downloadNotes` 物料一览  
    期望订货数量 **`8瓶`**（或等价 **`1.6箱`**）

# 注意点
- 牛肉：1 箱 = 5 瓶；箱/瓶 id 经 `/free/query`，禁止写死
- **必须先入库再改业务日**（`sendNote` → `batchProcessNote(instock)` → `updateNoteTime`）
- 改业务日用 `/app/note/updateNoteTime`，不要用 `/free/update`
- 仅 1 单时不会生成「物料一览」，单日校验走订单 title 对应 sheet
- 跨日汇总靠 `group.begin/end`，入库后 `status=instocked`
- `downloadNotes` 参数挂 URL query（含 `warehouseGroupId`）
- 嵌套 TestCase / 每个 Action 都有 remark

import { BaseTest, CheckUtil, DateUtil, TestCase } from "testflow";
import ListMaterial from "../../action/material/ListMaterial";
import AddPurcharse from "../../action/note/AddPurcharse";
import CreateNote3M from "../../action/note/CreateNote3M";
import ListNoteGroup from "../../action/note/ListNoteGroup";
import UpdatePurchase from "../../action/note/UpdatePurchase";
import PreTest from "../PreTest";
import ListNoteItem from "../../action/noteItem/ListNoteItem";
import BatchProcessNote from "../../action/note/BatchProcessNote";
import ListNoteFromGroup from "../../action/note/ListNoteFromGroup";
import BatchProcessByNoteId from "../../action/note/BatchProcessByNoteId";
import CreateBillAllNotes from "../../action/bill/CreateBillAllNotes";
import AddMaterial from "../../action/material/AddMaterial";
import NeedUpdatePriceNote from "../../action/price/NeedUpdatePriceNote";
import NeedUpdateMaterials from "../../action/price/NeedUpdateMaterials";
import UpdatePrice4Note from "../../action/price/UpdatePrice4Note";
import UpdatePrice4Material from "../../action/price/UpdatePrice4Material";
import GetMaterialInfo from "../../action/material/GetMaterialInfo";
import ListNoteByQuery from "../../action/note/ListNoteByQuery";
import QueryAction from "../../action/QueryAction";
import ProcessNote from "../../action/note/ProcessNote";
import SplitNote from "../../action/note/SplitNote";
import Action from "../../action/Action";
import StockUtil from "../../util/StockUtil";
import BatchCancelInstockCase from "./BatchCancelInstockCase";

/**
 * 订单流程
 */
export default class extends TestCase {
  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    const today = DateUtil.format(new Date());
    const changedDay = DateUtil.format(DateUtil.beforeDay(new Date(), 3));
    const tomorrow = DateUtil.format(DateUtil.afterDay(new Date(), 1));
    const changedTime = changedDay + ' 12:00:00';
    return [
      new PreTest(),
      new AddMaterial('狗肉', {
        suppliers: [
          {
            "isDef": true,
            "supplierId": "${supplierMap.供应商1}",

            "price": 10
          }]
      }),
      new ListMaterial(),

      //第一页面批量处理

      new CreateNote3M(),
      new ListMaterial({
        hasPurcharse: 0
      }),

      new ListNoteGroup({
        groupType: 'NoteDay',
        len: 1,
        noteCnt: 2
      }),

      new BatchProcessNote({
        action: 'instock'
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'instocked',
        len: 1,
        noteCnt: 2
      }),
      new BatchProcessNote({
        action: 'statement'
      }),

      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'statement',
        len: 1,
        noteCnt: 2
      }),

      // 第二界面处理
      new CreateNote3M(),
      new ListNoteGroup({
        groupType: 'NoteDay',
        len: 1,
        noteCnt: 2
      }),
      new ListNoteFromGroup({
        notes: [
          { cost: 846 },
          { cost: 500 }
        ]
      }),
      new BatchProcessByNoteId({
        index: 0
      }),
      new BatchProcessByNoteId({
        index: 1
      }),
      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'instocked',
        len: 1,
        noteCnt: 2
      }),
      new ListNoteFromGroup({
        notes: [
          { cost: 846 },
          { cost: 500 }
        ]
      }),
      new BatchProcessByNoteId({
        index: 0,
        action: 'statement'
      }),
      new BatchProcessByNoteId({
        index: 1,
        action: 'statement'
      }),

      new ListNoteGroup({
        groupType: 'NoteDay',
        status: 'statement',
        len: 1,
        noteCnt: 4
      }),

      // 第三页面处理
      ... new CreateNote3M().getActions(),
      ... new CreateNote3M({
        noBuildSupplier: true,
        items: [
          {
            "materialId": '${materialMap.猪肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 400,
            "buyUnitFee": 1,
            "stockUnitsId": 5,
            "price": 21,
            "stockBuyUnitFee": -10
          },
          {
            "materialId": '${materialMap.羊肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 30,
            "buyUnitFee": 500,
            "stockUnitsId": 29,
            "price": 0.2,
            "stockBuyUnitFee": 500
          },
          {
            "materialId": '${materialMap.狗肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 30,
            "buyUnitFee": 1,
            "stockUnitsId": 18,
            "price": 10,
            "stockBuyUnitFee": 1
          }
        ],
        checkNotes: [
          {
            materialCnt: 3,
            cost: 1146
          }
        ]
      }).getActions(),
      ... new CreateNote3M({
        noBuildSupplier: true,
        items: [
          {
            "materialId": '${materialMap.猪肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 400,
            "buyUnitFee": 1,
            "stockUnitsId": 5,
            "price": 21,
            "stockBuyUnitFee": -10
          },
          {
            "materialId": '${materialMap.羊肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 30,
            "buyUnitFee": 500,
            "stockUnitsId": 29,
            "price": 0.2,
            "stockBuyUnitFee": 500
          },
          {
            "materialId": '${materialMap.狗肉.materialId}',
            "supplierId": '${supplierMap.供应商1}',
            "cnt": 30,
            "buyUnitFee": 1,
            "stockUnitsId": 18,
            "price": 10,
            "stockBuyUnitFee": 1
          }
        ],
        checkNotes: [
          {
            materialCnt: 3,
            cost: 1146
          }
        ]
      }).getActions(),
      new ListNoteGroup({
        groupType: 'NoteDay',
        len: 1,
        noteCnt: 4
      }),
      new ListNoteItem({
        supplierName: '供应商1'
      }),
      new NeedUpdatePriceNote({}),
      new UpdatePrice4Note(),

      new NeedUpdateMaterials({}),
      new UpdatePrice4Material(),

      new GetMaterialInfo({
        price: 20
      }),
      new ListNoteByQuery({
        query: {
          status: 'normal',
        },
        checkNotes: [
          { cost: 1106 },
          { cost: 500 },
          { cost: 806 }
        ]
      }),
      new QueryAction({
        name: '查询订单物料',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: "${noteMap.806}"
        }
      }, {
        buildVariable(result) {
          return {
            noteItems: result.result.content
          }
        }
      }),

      new ProcessNote({

        noteId: "${noteMap.806}",
        noteItems: "${noteItems}",
        buildItem(item) {
          return {
            ...item,
            instockCnt: item.cnt / 2
          }
        }
      }),
      new QueryAction({
        name: '查询已处理订单',
        url: '/app/note/listNote',
        query: {
          status: 'instocked'
        }

      }, {
        check(result) {
          let content: any[] = result.result.content;
          for (let row of content) {
            CheckUtil.expectEqual(row.instockCost, row.cost / 2)
          }
        },
      }),

      new QueryAction({
        name: '查询1106元订单物料',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${noteMap.1106}'
        }

      }, {
        buildVariable(result) {
          let content = result.result.content;
          content = content.filter(row => row.name == '狗肉')
          return {
            noteItemId: content[0].noteItemId
          }
        }
      }),

      new SplitNote({
        noteId: '${noteMap.1106}'
      }),

      new ListNoteByQuery({
        query: {
          status: 'normal',
        },
        checkNotes: [
          { cost: 300 },
          { cost: 500 },
          { cost: 806 }
        ]
      }),
      new Action({
        name: '创建手工单',
        url: '/app/note/createHandInstock',
        param: {
          "warehouseId": "${warehouse.warehouseId}",
          "items": [
            {
              "cnt": 100,
              "supplierId": "${supplierMap.供应商1}",
              "stockUnitsId": 5,
              "materialId": "${materialMap.猪肉.materialId}",
              "price": 20,
              "buyUnitFee": 1,
              "stockBuyUnitFee": -10
            },
            {
              "cnt": 2000,
              "supplierId": "${supplierMap.供应商1}",
              "stockUnitsId": 29,
              "materialId": "${materialMap.羊肉.materialId}",
              "price": 0.2,
              "buyUnitFee": 500,
              "stockBuyUnitFee": 500
            },
            {
              "cnt": 30,
              "supplierId": "${supplierMap.供应商2}",
              "stockUnitsId": 18,
              "materialId": "${materialMap.牛肉.materialId}",
              "price": 10,
              "buyUnitFee": 1,
              "stockBuyUnitFee": 1
            }
          ]
        }
      }),
      new QueryAction({
        name: '验证手动单',
        url: '/app/note/listNote',
        query: {
          status: "instocked",
          origin: 'hand'
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content;
          content = content.filter(row => row.origin == 'hand')
          CheckUtil.expectFindByArray(content, [
            { cost: 300 },
            { cost: 600 }
          ])
        }
      }),

      // beginUpdateTime / endUpdateTime：按状态取时间
      // normal→createTime，instocked→instockTime，statement→statementTime
      new QueryAction({
        name: '当天状态时间查出未入库单',
        url: '/app/note/listNote',
        query: {
          status: 'normal',
          beginUpdateTime: today,
          endUpdateTime: today
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectFindByArray(content, [
            { cost: 300 },
            { cost: 500 },
            { cost: 806 }
          ]);
        }
      }),
      new QueryAction({
        name: '校验待入库订单金额',
        url: '/app/note/listNote',
        query: {
          status: 'normal',
          beginUpdateTime: today,
          endUpdateTime: today
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectFindByArray(content, [
            { defCnt: 300 },
            { defCnt: 500 },
            { defCnt: 806 }
          ]);
          for (let row of content) {
            CheckUtil.expectEqual(
              Number(row.defCnt),
              Number(row.cost),
              `待入库订单${row.noteId}金额应等于订货金额，defCnt=${row.defCnt}，cost=${row.cost}`
            );
          }
        }
      }).setHighlight(true).setRemark('待入库：defCnt 等于订货金额'),
      new QueryAction({
        name: '三天前状态时间查不出未入库单',
        url: '/app/note/listNote',
        query: {
          status: 'normal',
          beginUpdateTime: changedDay,
          endUpdateTime: changedDay
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 0, `三天前不应查出未入库单，实际=${JSON.stringify(content)}`);
        }
      }),
      new QueryAction({
        name: '当天状态时间查出手工单',
        url: '/app/note/listNote',
        query: {
          status: 'instocked',
          origin: 'hand',
          beginUpdateTime: today,
          endUpdateTime: today
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectFindByArray(content, [
            { cost: 300 },
            { cost: 600 }
          ]);
          let row = content.find(item => item.cost == 300);
          return {
            handNoteId: row.noteId
          };
        }
      }),
      new QueryAction({
        name: '明天状态时间查不出手工单',
        url: '/app/note/listNote',
        query: {
          status: 'instocked',
          origin: 'hand',
          beginUpdateTime: tomorrow,
          endUpdateTime: tomorrow
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(content.length, 0, `明天不应查出手工单，实际=${JSON.stringify(content)}`);
        }
      }),
      new Action({
        name: '更改手工单创建时间',
        url: '/app/note/updateNoteTime',
        param: {
          noteId: '${handNoteId}',
          sysAddTime: changedTime,
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),
      new QueryAction({
        name: '按创建时间查出改期手工单',
        url: '/app/note/listNote',
        query: {
          status: 'instocked',
          origin: 'hand',
          begin: changedDay,
          end: changedDay
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          let row = content.find(item => item.noteId == variable.handNoteId);
          CheckUtil.expectEqual(row != null, true, '按创建时间应查出改期手工单');
          CheckUtil.expectNotFind(content, { cost: 600 }, '未改期的手工单不应出现在三天前');
        }
      }),
      new QueryAction({
        name: '改期日状态时间查不出手工单',
        url: '/app/note/listNote',
        query: {
          status: 'instocked',
          origin: 'hand',
          beginUpdateTime: changedDay,
          endUpdateTime: changedDay
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectNotFind(content, { noteId: variable.handNoteId }, '已入库单应按入库时间过滤，改创建时间后仍不应出现在三天前');
        }
      }),
      new QueryAction({
        name: '当天状态时间仍查出改期手工单',
        url: '/app/note/listNote',
        query: {
          status: 'instocked',
          origin: 'hand',
          beginUpdateTime: today,
          endUpdateTime: today
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          let row = content.find(item => item.noteId == variable.handNoteId);
          CheckUtil.expectEqual(row != null, true, '已入库单的状态时间是入库时间，当天仍应查出');
          CheckUtil.expectFindByArray(content, [
            { cost: 600 }
          ]);
        }
      }),
      new Action({
        name: '结算改期手工单',
        url: '/app/note/batchProcessNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          action: 'statement',
          noteIds: ['${handNoteId}'],
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }),
      new QueryAction({
        name: '校验已结算推荐数量',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${handNoteId}'
        }
      }, {
        check(result) {
          let rows: any[] = result.result.content ?? [];
          CheckUtil.expectEqual(rows.length > 0, true, '已结算手工单应有明细');
          for (let row of rows) {
            CheckUtil.expectEqual(
              StockUtil.isEq(row.defCnt, row.statementCnt),
              true,
              `${row.name}已结算推荐数量应为结算数量`
            );
          }
        }
      }),
      new QueryAction({
        name: '校验已结算订单金额',
        url: '/app/note/listNote',
        query: {
          noteId: '${handNoteId}'
        }
      }, {
        check(result) {
          let row = (result.result.content ?? [])[0];
          CheckUtil.expectEqual(row != null, true, '应查到已结算手工单');
          CheckUtil.expectEqual(
            Number(row.defCnt),
            Number(row.statementCost),
            '已结算订单金额应等于结算金额'
          );
          CheckUtil.expectEqual(Number(row.defCnt), 300, `已结算订单金额应为300，实际=${row?.defCnt}`);
        }
      }).setHighlight(true).setRemark('已结算：defCnt 等于结算金额 300'),
      new QueryAction({
        name: '按创建时间查出已结算改期单',
        url: '/app/note/listNote',
        query: {
          status: 'statement',
          begin: changedDay,
          end: changedDay
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          let row = content.find(item => item.noteId == variable.handNoteId);
          CheckUtil.expectEqual(row != null, true, '结算后创建时间仍是三天前，按创建时间应查出');
        }
      }),
      new QueryAction({
        name: '改期日状态时间查不出已结算单',
        url: '/app/note/listNote',
        query: {
          status: 'statement',
          beginUpdateTime: changedDay,
          endUpdateTime: changedDay
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          CheckUtil.expectNotFind(content, { noteId: variable.handNoteId }, '已结算单应按结算时间过滤，不应出现在三天前');
        }
      }),
      new QueryAction({
        name: '当天状态时间查出已结算改期单',
        url: '/app/note/listNote',
        query: {
          status: 'statement',
          beginUpdateTime: today,
          endUpdateTime: today
        }
      }, {
        check(result) {
          let content: any[] = result.result.content ?? [];
          let row = content.find(item => item.noteId == variable.handNoteId);
          CheckUtil.expectEqual(row != null, true, '已结算单的状态时间是结算时间，当天应查出');
        }
      }),

      ...this.buildUpdateNoteItem(),
      new BatchCancelInstockCase()

    ]
  }

  /**
   * 简略走一遍修改订单物料：待入库改入库草稿，入库后改对账草稿。
   * 改价且已入库时，入库金额和库存流水按入库数量重算。
   */
  private buildUpdateNoteItem(): BaseTest[] {
    let variable = this.getVariable();
    return [
      new Action({
        name: '下单狗肉',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          items: [{
            materialId: '${materialMap.狗肉.materialId}',
            supplierId: '${supplierMap.供应商1}',
            cnt: 2,
            buyUnitFee: 1,
            stockUnitsId: 0,
            price: 10,
            stockBuyUnitFee: 1
          }],
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          let content = result.result;
          let row = Array.isArray(content) ? content[0] : content;
          return {
            editNoteId: row.noteId
          };
        }
      }),
      new Action({
        name: '发送狗肉订单',
        url: '/app/note/sendNote',
        method: 'POST',
        param: {
          noteIds: [],
          status: 'normal',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        parseHttpParam(param, variable) {
          param.noteIds = [variable.editNoteId];
          return param;
        }
      }),
      new QueryAction({
        name: '读取狗肉物料',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${editNoteId}'
        }
      }, {
        buildVariable(result) {
          return {
            noteItems: result.result.content
          };
        }
      }),
      new Action({
        name: '待入库改入库草稿',
        url: '/app/noteItem/updateNoteItem',
        method: 'POST',
        param: {
          noteId: '${editNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          datas: {}
        }
      }, {
        parseHttpParam(param, variable) {
          let item = (variable.noteItems as any[]).find(row => row.name == '狗肉');
          param.datas = {
            update: [{
              noteItemId: item.noteItemId,
              cnt: { cnt: 3, buyUnitFee: 1 }
            }]
          };
          return param;
        }
      }),
      new QueryAction({
        name: '校验订货修改',
        url: '/app/note/listNote',
        query: {
          noteId: '${editNoteId}'
        }
      }, {
        check(result) {
          let row = result.result.content[0];
          CheckUtil.expectEqual(row.materialCnt, 1, '物料款数');
          CheckUtil.expectEqual(Number(row.cost), 20, '订货金额不变');
          CheckUtil.expectEqual(Number(row.defCnt), 20, '待入库订单金额仍为订货金额');
          CheckUtil.expectEqual(
            Number(row.defCnt),
            Number(row.cost),
            '待入库订单金额应等于订货金额'
          );
        }
      }).setHighlight(true).setRemark('待入库改入库草稿后，defCnt 仍是订货金额 20'),
      new QueryAction({
        name: '校验入库草稿',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${editNoteId}'
        }
      }, {
        check(result) {
          let row = result.result.content.find(item => item.name == '狗肉');
          CheckUtil.expectEqual(
            StockUtil.isEq(row.purcharse, { cnt: 2, buyUnitFee: 1 }),
            true,
            '订货数量仍为2'
          );
          CheckUtil.expectEqual(
            StockUtil.isEq(row.instock, { cnt: 3, buyUnitFee: 1 }),
            true,
            '入库草稿应为3'
          );
          CheckUtil.expectEqual(
            StockUtil.isEq(row.defCnt, { cnt: 2, buyUnitFee: 1 }),
            true,
            '待入库且没有关联发货、拣货时，推荐数量应为订货数量'
          );
        }
      }),
      new Action({
        name: '入库狗肉订单',
        url: '/app/note/batchProcessNote',
        method: 'POST',
        param: {
          action: 'instock',
          type: 'purcharse',
          noteIds: [],
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        parseHttpParam(param, variable) {
          param.noteIds = [variable.editNoteId];
          return param;
        }
      }),
      new Action({
        name: '入库后改对账草稿并改价',
        url: '/app/noteItem/updateNoteItem',
        method: 'POST',
        param: {
          noteId: '${editNoteId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          datas: {}
        }
      }, {
        parseHttpParam(param, variable) {
          let item = (variable.noteItems as any[]).find(row => row.name == '狗肉');
          param.datas = {
            update: [{
              noteItemId: item.noteItemId,
              cnt: { cnt: 4, buyUnitFee: 1 },
              price: { price: 20, buyUnitFee: 1 }
            }]
          };
          return param;
        }
      }),
      new QueryAction({
        name: '校验改价后的入库金额',
        url: '/app/note/listNote',
        query: {
          noteId: '${editNoteId}'
        }
      }, {
        check(result) {
          let row = result.result.content[0];
          CheckUtil.expectEqual(Number(row.instockCost), 60, '入库金额按3包新单价');
          CheckUtil.expectEqual(Number(row.cost), 40, '订货金额按2包新单价');
          CheckUtil.expectEqual(Number(row.defCnt), 60, '已入库订单金额应为入库金额');
          CheckUtil.expectEqual(
            Number(row.defCnt),
            Number(row.instockCost),
            '已入库订单金额应等于入库金额'
          );
        }
      }).setHighlight(true).setRemark('已入库：defCnt 等于入库金额 60，不是订货金额 40'),
      new QueryAction({
        name: '校验对账草稿',
        url: '/app/noteItem/listNoteItem',
        query: {
          noteId: '${editNoteId}'
        }
      }, {
        check(result) {
          let row = result.result.content.find(item => item.name == '狗肉');
          CheckUtil.expectEqual(
            StockUtil.isEq(row.instock, { cnt: 3, buyUnitFee: 1 }),
            true,
            '入库数量仍为3'
          );
          CheckUtil.expectEqual(
            StockUtil.isEq(row.statementCnt, { cnt: 4, buyUnitFee: 1 }),
            true,
            '对账草稿应为4'
          );
          CheckUtil.expectEqual(
            StockUtil.isEq(row.purcharse, { cnt: 2, buyUnitFee: 1 }),
            true,
            '订货数量仍为2'
          );
          CheckUtil.expectEqual(
            StockUtil.isEq(row.defCnt, { cnt: 3, buyUnitFee: 1 }),
            true,
            '已入库推荐数量应为入库数量'
          );
        }
      }),
      new Action({
        name: '校验改价后的入库流水',
        url: '/free/query',
        param: {
          array: [{
            table: 'stock_record',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0,
              type: 'Instock'
            }
          }]
        }
      }, {
        check(result) {
          let item = (variable.noteItems as any[]).find(row => row.name == '狗肉');
          let rows: any[] = result.result?.stock_record ?? [];
          let matched = rows.filter(row => String(row.noteItemId) === String(item.noteItemId));
          CheckUtil.expectEqual(matched.length, 1, `狗肉入库流水应为1条，实际${matched.length}`);
          if (matched.length === 0) {
            return;
          }
          CheckUtil.expectEqual(
            StockUtil.isEq(
              { cnt: matched[0].cnt ?? 0, buyUnitFee: matched[0].buyUnitFee ?? 1 },
              { cnt: 3, buyUnitFee: 1 }
            ),
            true,
            '入库流水数量仍为3'
          );
          CheckUtil.expectEqual(Number(matched[0].cost), 60, '入库流水金额');
        }
      })
    ];
  }

  getName(): string {
    return '订单流程'
  }


}
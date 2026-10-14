import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";

/** 跨页造数条数，大于列表默认页大小 */
const SCH_TOTAL = 1000
/** _schParam 里的页大小，全选应忽略分页 */
const SCH_PAGE_SIZE = 20
/** 反选下标：首页、翻页边界、中段、末页 */
const SCH_EXCLUDE_INDEXES = [0, 19, 20, 500, 999]
const SCH_TITLE = '跨页选择'

/**
 * 订单分组 + listNote / listNoteInfo（按状态、物料、分组查询）+ 跨页全选入组。
 * 见同目录 FlowTeam.md。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '订单分组：建物料与订单、分组增删改查、按状态/物料/分组查询、跨页全选入组' })
  }

  getName(): string {
    return '订单分组'
  }

  protected buildActions(): BaseTest[] {
    return [
      new PreTest({
        materialsOpts: [
          { name: '苹果', category: '蔬菜', unit: '斤' },
          { name: '梨', category: '蔬菜', unit: '斤' },
          { name: '香蕉', category: '蔬菜', unit: '斤' }
        ]
      }),
      new CreateOrder1(),
      new CreateOrder2(),
      new CreateOrder3(),
      new TeamCrud(),
      new BindNotesToTeam(),
      ...this.buildQueryCases(),
      new CrossPageAddNotes()
    ]
  }

  private buildQueryCases(): BaseTest[] {
    return [
      this.buildQueryCase({
        name: '按入库状态查询',
        remark: 'status=instocked → 仅订单2；金额取 instockCost=20',
        param: { status: 'instocked' },
        titles: ['订单2'],
        info: { cnt: 1, cost: 20 }
      }),
      this.buildQueryCase({
        name: '按物料梨查询',
        remark: 'materialId=梨 → 订单1(cost10)+订单2(instockCost20)',
        param: { materialId: '${materialMap.梨.materialId}' },
        titles: ['订单1', '订单2'],
        info: { cnt: 2, cost: 30 }
      }),
      this.buildQueryCase({
        name: '按订单组2查询',
        remark: 'teamId=组2 → 订单2+订单3；20+30=50',
        param: { teamId: '${team2Id}' },
        titles: ['订单2', '订单3'],
        info: { cnt: 2, cost: 50 }
      }),
      this.buildQueryCase({
        name: '按入库+梨+组2查询',
        remark: '三条件交集 → 仅订单2',
        param: {
          status: 'instocked',
          materialId: '${materialMap.梨.materialId}',
          teamId: '${team2Id}'
        },
        titles: ['订单2'],
        info: { cnt: 1, cost: 20 }
      })
    ]
  }

  private buildQueryCase(opt: {
    name: string
    remark: string
    param: any
    titles: string[]
    info: { cnt: number, cost: number }
  }): TestCase {
    return new (class extends TestCase {
      constructor() {
        super({ remark: opt.remark })
      }
      getName(): string {
        return opt.name
      }
      protected buildActions(): BaseTest[] {
        return [
          new Action({
            name: `listNote:${opt.name}`,
            remark: opt.remark,
            url: '/app/note/listNote',
            param: {
              warehouseId: '${warehouse.warehouseId}',
              ...opt.param
            }
          }, {
            check(result) {
              let content: any[] = result.result.content ?? []
              let titles = content.map(row => row.title).sort()
              CheckUtil.expectEqualArray(
                titles.map(title => ({ title })),
                [...opt.titles].sort().map(title => ({ title }))
              )
            }
          }),
          new Action({
            name: `listNoteInfo:${opt.name}`,
            remark: `汇总 cnt/cost；cost 按状态取对应金额字段`,
            url: '/app/note/listNoteInfo',
            param: {
              warehouseId: '${warehouse.warehouseId}',
              ...opt.param
            }
          }, {
            check(result) {
              let info = result.result
              CheckUtil.expectEqual(info.cnt, opt.info.cnt)
              CheckUtil.expectEqual(info.cost, opt.info.cost)
            }
          })
        ]
      }
    })()
  }
}

/** 订单1：苹果+梨，订货 10，状态 normal */
class CreateOrder1 extends TestCase {
  constructor() {
    super({ remark: '下单苹果1@5、梨1@5，发单；title=订单1' })
  }
  getName(): string {
    return '新建订单1'
  }
  protected buildActions(): BaseTest[] {
    return [
      this.createNote('订单1', 'note1', [
        { name: '苹果', cnt: 1, price: 5 },
        { name: '梨', cnt: 1, price: 5 }
      ]),
      new Action({
        name: '发送订单1',
        url: '/app/note/sendNote',
        param: {
          noteIds: ['${note1Id}'],
          status: 'normal'
        }
      }),
      this.updateTitle('note1Id', '订单1')
    ]
  }

  private createNote(name: string, key: string, items: { name: string, cnt: number, price: number }[]) {
    return new Action({
      name: `createNote:${name}`,
      url: '/app/note/createNote',
      method: 'POST',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        items: items.map(item => ({
          materialId: `\${materialMap.${item.name}.materialId}`,
          supplierId: '${supplierMap.供应商1}',
          cnt: item.cnt,
          buyUnitFee: 1,
          stockUnitsId: 0,
          price: item.price,
          stockBuyUnitFee: 1
        }))
      }
    }, {
      buildVariable(result) {
        let content: any[] = result.result
        return {
          [`${key}Id`]: content[0].noteId,
          [key]: content[0]
        }
      }
    })
  }

  private updateTitle(idKey: string, title: string) {
    return new Action({
      name: `设置标题${title}`,
      url: '/free/update',
      param: {
        table: 'note',
        cdts: [{ col: 'noteId', val: `\${${idKey}}` }],
        data: { title }
      }
    })
  }
}

/** 订单2：梨+香蕉，订货40，入库20 */
class CreateOrder2 extends TestCase {
  constructor() {
    super({ remark: '梨2@10、香蕉2@10；入库各1 → instockCost=20；title=订单2' })
  }
  getName(): string {
    return '新建订单2并入库'
  }
  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote:订单2',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          items: [
            {
              materialId: '${materialMap.梨.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 2,
              buyUnitFee: 1,
              stockUnitsId: 0,
              price: 10,
              stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.香蕉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 2,
              buyUnitFee: 1,
              stockUnitsId: 0,
              price: 10,
              stockBuyUnitFee: 1
            }
          ]
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result
          return {
            note2Id: content[0].noteId,
            note2: content[0]
          }
        }
      }),
      new Action({
        name: '发送订单2',
        url: '/app/note/sendNote',
        param: {
          noteIds: ['${note2Id}'],
          status: 'normal'
        }
      }),
      new Action({
        name: '订单2入库半量',
        remark: '梨/香蕉各入库1，instockCost=20',
        url: '/app/note/processNote',
        param: {
          noteId: '${note2Id}',
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(ret: any, variable: any) {
          let noteItems: any[] = variable.note2.noteItems
          ret.noteItems = noteItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            cnt: row.cnt,
            instockCnt: 1,
            price: row.price,
            stockBuyUnitFee: row.stockBuyUnitFee,
            materialId: row.materialId,
            yieldRate: 0
          }))
          return ret
        }
      }),
      new Action({
        name: '设置标题订单2',
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [{ col: 'noteId', val: '${note2Id}' }],
          data: { title: '订单2' }
        }
      })
    ]
  }
}

/**
 * 订单3：香蕉+苹果，订货60，入库40，结算30。
 * 结算默认按入库量，结算后用 /free/update 把 statementCost 调成 30。
 */
class CreateOrder3 extends TestCase {
  constructor() {
    super({ remark: '香蕉3@10、苹果3@10；入库各2；结算后 statementCost=30' })
  }
  getName(): string {
    return '新建订单3并结算'
  }
  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: 'createNote:订单3',
        url: '/app/note/createNote',
        method: 'POST',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          items: [
            {
              materialId: '${materialMap.香蕉.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 3,
              buyUnitFee: 1,
              stockUnitsId: 0,
              price: 10,
              stockBuyUnitFee: 1
            },
            {
              materialId: '${materialMap.苹果.materialId}',
              supplierId: '${supplierMap.供应商1}',
              cnt: 3,
              buyUnitFee: 1,
              stockUnitsId: 0,
              price: 10,
              stockBuyUnitFee: 1
            }
          ]
        }
      }, {
        buildVariable(result) {
          let content: any[] = result.result
          return {
            note3Id: content[0].noteId,
            note3: content[0]
          }
        }
      }),
      new Action({
        name: '发送订单3',
        url: '/app/note/sendNote',
        param: {
          noteIds: ['${note3Id}'],
          status: 'normal'
        }
      }),
      new Action({
        name: '订单3入库',
        remark: '香蕉/苹果各入库2，instockCost=40',
        url: '/app/note/processNote',
        param: {
          noteId: '${note3Id}',
          action: 'instock',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        parseHttpParam(ret: any, variable: any) {
          let noteItems: any[] = variable.note3.noteItems
          ret.noteItems = noteItems.map((row: any) => ({
            noteItemId: row.noteItemId,
            cnt: row.cnt,
            instockCnt: 2,
            price: row.price,
            stockBuyUnitFee: row.stockBuyUnitFee,
            materialId: row.materialId,
            yieldRate: 0
          }))
          return ret
        }
      }),
      new Action({
        name: '订单3结算',
        url: '/app/note/processNote',
        param: {
          noteId: '${note3Id}',
          action: 'statement',
          warehouseId: '${warehouse.warehouseId}'
        }
      }),
      new Action({
        name: '设置订单3标题与结算金额',
        remark: 'title=订单3；statementCost 调为30（结算默认等于入库40）',
        url: '/free/update',
        param: {
          table: 'note',
          cdts: [{ col: 'noteId', val: '${note3Id}' }],
          data: {
            title: '订单3',
            statementCost: 30
          }
        }
      })
    ]
  }
}

/** 分组增删改查，最后剩组1、组2 */
class TeamCrud extends TestCase {
  constructor() {
    super({ remark: '增删改查订单组；临时组删掉后剩组1、组2' })
  }
  getName(): string {
    return '订单组增删改查'
  }
  protected buildActions(): BaseTest[] {
    return [
      this.addTeam('组1', 'team1Id'),
      this.listTeam('查询含组1', ['组1']),
      this.addTeam('组2', 'team2Id'),
      this.listTeam('查询含组1组2', ['组1', '组2']),
      this.addTeamFail('组1', '重复创建组1应失败'),
      this.updateTeamFail('team2Id', '组1', '组2改名为组1应失败'),
      this.listTeam('同名失败后仍是组1组2', ['组1', '组2']),
      this.addTeam('临时组', 'teamTempId'),
      this.listTeam('查询三个分组', ['组1', '组2', '临时组']),
      new Action({
        name: '改名临时组',
        url: '/app/team/updateTeam',
        param: {
          teamId: '${teamTempId}',
          warehouseId: '${warehouse.warehouseId}',
          name: '待删组'
        }
      }),
      this.listTeam('查询改名后', ['组1', '组2', '待删组']),
      new Action({
        name: '删除待删组',
        url: '/app/team/delTeam',
        param: {
          teamId: '${teamTempId}',
          warehouseId: '${warehouse.warehouseId}'
        }
      }),
      this.listTeam('删除后剩组1组2', ['组1', '组2'])
    ]
  }

  private addTeam(name: string, idKey: string) {
    return new Action({
      name: `创建${name}`,
      url: '/app/team/addTeam',
      param: {
        warehouseId: '${warehouse.warehouseId}',
        name
      }
    }, {
      buildVariable(result) {
        return {
          [idKey]: result.result.teamId
        }
      }
    })
  }

  private addTeamFail(name: string, actionName: string) {
    return new Action({
      name: actionName,
      remark: '相同 warehouseId 下分组名称不能重复',
      url: '/app/team/addTeam',
      exceptHttpStatus: 500,
      param: {
        warehouseId: '${warehouse.warehouseId}',
        name
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(
          result?.error?.message,
          '相同仓库下分组名称不能重复'
        )
      }
    })
  }

  private updateTeamFail(teamIdKey: string, name: string, actionName: string) {
    return new Action({
      name: actionName,
      remark: '相同 warehouseId 下分组名称不能重复',
      url: '/app/team/updateTeam',
      exceptHttpStatus: 500,
      param: {
        teamId: `\${${teamIdKey}}`,
        warehouseId: '${warehouse.warehouseId}',
        name
      }
    }, {
      check(result) {
        CheckUtil.expectEqual(
          result?.error?.message,
          '相同仓库下分组名称不能重复'
        )
      }
    })
  }

  private listTeam(name: string, expectNames: string[]) {
    return new Action({
      name,
      url: '/app/team/listTeam',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    }, {
      check(result) {
        let content: any[] = result.result.content ?? []
        let names = content.map(row => row.name).sort()
        CheckUtil.expectEqualArray(
          names.map(n => ({ name: n })),
          [...expectNames].sort().map(n => ({ name: n }))
        )
      }
    })
  }
}

/** 订单1、2入组1；全部入组2后再从组2删订单1 */
class BindNotesToTeam extends TestCase {
  constructor() {
    super({ remark: '组1←订单1+2；组2←全部再删订单1' })
  }
  getName(): string {
    return '订单加入分组'
  }
  protected buildActions(): BaseTest[] {
    return [
      new Action({
        name: '组1加入订单1、2',
        url: '/app/team/addNotes',
        param: {
          teamId: '${team1Id}',
          warehouseId: '${warehouse.warehouseId}',
          noteIds: ['${note1Id}', '${note2Id}']
        }
      }),
      new Action({
        name: '组2加入全部订单',
        url: '/app/team/addNotes',
        param: {
          teamId: '${team2Id}',
          warehouseId: '${warehouse.warehouseId}',
          noteIds: ['${note1Id}', '${note2Id}', '${note3Id}']
        }
      }),
      new Action({
        name: '组2删除订单1',
        url: '/app/team/delNotes',
        param: {
          teamId: '${team2Id}',
          warehouseId: '${warehouse.warehouseId}',
          noteIds: ['${note1Id}']
        }
      })
    ]
  }
}

/**
 * 跨页全选入组。
 * /free/add 造 1000 张订单，每张一条 noteItem（materialId=1）。
 * addNotes 走 _schParam（带分页和 _notInIds），新分组应只含未被反选的订单。
 */
class CrossPageAddNotes extends TestCase {
  constructor() {
    super({
      remark: `造${SCH_TOTAL}张订单跨页全选入组，_notInIds 反选${SCH_EXCLUDE_INDEXES.length}张`
    })
  }

  getName(): string {
    return '跨页选择加入分组'
  }

  protected buildActions(): BaseTest[] {
    let variable = this.getVariable()
    return [
      new Action({
        name: `插入${SCH_TOTAL}个订单`,
        remark: `title=${SCH_TITLE}，供跨页全选`,
        url: '/free/add',
        method: 'POST',
        param: {
          table: 'note',
          array: []
        }
      }, {
        parseHttpParam(param, variable) {
          let warehouseId = variable.warehouse.warehouseId
          let warehouseGroupId = variable.warehouse.warehouseGroupId
          let supplierId = variable.supplierMap['供应商1']
          param.array = Array.from({ length: SCH_TOTAL }, () => ({
            warehouseId,
            warehouseGroupId,
            supplierId,
            isDel: 0,
            status: 'normal',
            type: 'purcharse',
            origin: 'normal',
            title: SCH_TITLE,
            materialCnt: 1,
            linkNoteId: 0,
            parenNoteId: 0
          }))
          return param
        },
        buildVariable(result) {
          let rows: any[] = result.result ?? []
          let ids = rows.map(row => row.noteId)
          let exclude = SCH_EXCLUDE_INDEXES.map(index => ids[index])
          let expect = ids.filter(id => exclude.indexOf(id) < 0)
          return {
            schNoteIds: ids,
            schExcludeIds: exclude,
            schExpectIds: expect
          }
        }
      }),
      new Action({
        name: `插入${SCH_TOTAL}条订单明细`,
        remark: 'materialId 均为 1，供 listNote 按物料跨页查询',
        url: '/free/add',
        method: 'POST',
        param: {
          table: 'noteItem',
          array: []
        }
      }, {
        parseHttpParam(param, variable) {
          let warehouseId = variable.warehouse.warehouseId
          let warehouseGroupId = variable.warehouse.warehouseGroupId
          let supplierId = variable.supplierMap['供应商1']
          let ids: any[] = variable.schNoteIds
          param.array = ids.map(noteId => ({
            noteId,
            materialId: 1,
            warehouseId,
            warehouseGroupId,
            supplierId,
            isDel: 0,
            cnt: 1,
            price: 1,
            buyUnitFee: 1,
            stockBuyUnitFee: 1,
            stockUnitsId: 0
          }))
          return param
        }
      }),
      new Action({
        name: '创建跨页组',
        url: '/app/team/addTeam',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          name: '跨页组'
        }
      }, {
        buildVariable(result) {
          return {
            schTeamId: result.result.teamId
          }
        }
      }),
      new Action({
        name: '跨页全选加入跨页组',
        remark: `_schParam 带 pageSize=${SCH_PAGE_SIZE}，_notInIds 反选${SCH_EXCLUDE_INDEXES.length}张，应忽略分页选中其余订单`,
        highlight: true,
        url: '/app/team/addNotes',
        param: {
          teamId: '${schTeamId}',
          warehouseId: '${warehouse.warehouseId}',
          _schParam: {
            warehouseId: '${warehouse.warehouseId}',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            materialId: 1,
            title: SCH_TITLE,
            pageSize: SCH_PAGE_SIZE,
            pageNo: 1,
            _notInIds: '${schExcludeIds}'
          }
        }
      }),
      new Action({
        name: '核对跨页组订单',
        remark: `新分组应有${SCH_TOTAL - SCH_EXCLUDE_INDEXES.length}张，反选的不在组里`,
        url: '/free/query',
        method: 'POST',
        param: {
          array: [{
            table: 'noteTeam',
            cols: ['noteId'],
            query: {
              teamId: '${schTeamId}',
              isDel: 0
            }
          }]
        }
      }, {
        check(result) {
          let rows: any[] = result.result?.noteTeam ?? []
          let ids = rows.map(row => Number(row.noteId)).sort((a, b) => a - b)
          let expectIds = (variable.schExpectIds ?? []).map((id: any) => Number(id)).sort((a, b) => a - b)
          let excludeIds = (variable.schExcludeIds ?? []).map((id: any) => Number(id))
          CheckUtil.expectEqual(
            ids.length,
            SCH_TOTAL - SCH_EXCLUDE_INDEXES.length,
            `跨页组应有${SCH_TOTAL - SCH_EXCLUDE_INDEXES.length}个订单，实际=${ids.length}`
          )
          for (let id of excludeIds) {
            CheckUtil.expectEqual(
              ids.indexOf(id) < 0,
              true,
              `反选订单 ${id} 不应在跨页组中`
            )
          }
          CheckUtil.expectEqual(
            JSON.stringify(ids),
            JSON.stringify(expectIds),
            '跨页组中的订单应等于全选结果去掉反选'
          )
        }
      })
    ]
  }
}

import { BaseTest, CheckUtil, HttpAction, TestCase } from 'testflow';

const NAME_PREFIX = 'schIdsPagSel_';
/** 造数条数：足够翻多页 */
const TOTAL = 12;
/** 每页条数 → 共 4 页（1..4） */
const PAGE_SIZE = 3;
const PAGE_CNT = TOTAL / PAGE_SIZE;
/** 反选排除条数 */
const EXCLUDE_CNT = 2;

/**
 * 分页选择 SchIds（见同目录 FlowSchIds.md / doc/分页选择.md）。
 * 使用 HttpAction，不注入 warehouseGroupId（test_num 无该字段）。
 */
export default class extends TestCase {
  constructor() {
    super({ remark: 'SchIds：全量主键/_onlyId/_notInIds；普通列表从第1页翻到最后一页' })
  }

  getName(): string {
    return '分页选择SchIds'
  }

  protected buildActions(): BaseTest[] {
    const variable = this.getVariable();
    variable.token = '';
    return [
      new HttpAction({
        remark: '按前缀查出可能残留的 schIds 测试数据 id',
        name: '查询旧数据',
        url: '/free/tests/listTestNumByTable',
        method: 'POST',
        param: {
          name: NAME_PREFIX,
          pageSize: 800,
          orderBy: 'testNumId'
        }
      }, {
        buildVariable(result) {
          const content = result?.result?.content ?? [];
          return {
            schIdsCleanupIds: content.map((r: any) => r.testNumId)
          };
        }
      }),

      new HttpAction({
        remark: '按 id 清理残留（无残留时 in [] 查不到，不删）',
        name: '清理旧数据',
        url: '/free/del',
        method: 'POST',
        param: {
          table: 'testNum',
          query: { testNumId: '${schIdsCleanupIds}' }
        }
      }),

      new HttpAction({
        remark: `插入${TOTAL}条 test_num，name=${NAME_PREFIX}1..${TOTAL}`,
        name: '插入测试数据',
        url: '/free/add',
        method: 'POST',
        param: {
          table: 'testNum',
          array: Array.from({ length: TOTAL }, (_, i) => {
            const n = i + 1;
            return {
              name: `${NAME_PREFIX}${n}`,
              val: n * 10,
              isDel: 0
            };
          })
        }
      }, {
        buildVariable(result) {
          const rows = result?.result ?? [];
          const ids = rows.map((r: any) => r.testNumId).sort((a: number, b: number) => a - b);
          const exclude = ids.slice(0, EXCLUDE_CNT);
          return {
            schIdsRows: rows,
            schIdsIds: ids,
            schIdsExcludeIds: exclude,
            schIdsAfterExclude: ids.filter((id: number) => !exclude.includes(id)),
            schIdsFlipIds: [] as number[]
          };
        }
      }),

      // ---- 普通列表：从第 1 页翻到最后一页（getTableName）----
      ...this.buildFlipPages('Table', '/free/tests/listTestNumByTable', variable),

      // ---- 普通列表：从第 1 页翻到最后一页（getDao）----
      ...this.buildFlipPages('Dao', '/free/tests/listTestNumByDao', variable),

      new HttpAction({
        remark: `SchIds(getTableName)：_schParam 带 pageSize=${PAGE_SIZE}，应返回全部${TOTAL}个 id`,
        name: 'SchIds主键列表-Table',
        url: '/free/tests/processSchIdsByTable',
        method: 'POST',
        param: {
          _schParam: {
            name: NAME_PREFIX,
            pageSize: PAGE_SIZE,
            pageNo: 1
          }
        }
      }, {
        check(result) {
          const ids = (result?.result?.ids ?? []).slice().sort((a: number, b: number) => a - b);
          const expectIds = variable.schIdsIds;
          CheckUtil.expectEqual(
            ids.length,
            TOTAL,
            `_onlyId 应忽略分页返回全部${TOTAL}个id，实际=${JSON.stringify(ids)}`
          );
          CheckUtil.expectEqual(
            JSON.stringify(ids),
            JSON.stringify(expectIds),
            `ids 应对上插入数据，实际=${JSON.stringify(ids)} expect=${JSON.stringify(expectIds)}`
          );
        }
      }),

      new HttpAction({
        remark: `SchIds(getDao+needObj)：返回全部${TOTAL}条对象，仅主键列且无 linked`,
        name: 'SchIds对象列表-Dao',
        url: '/free/tests/processSchIdsByDao',
        method: 'POST',
        param: {
          _schParam: {
            name: NAME_PREFIX,
            pageSize: PAGE_SIZE,
            pageNo: 1
          }
        }
      }, {
        check(result) {
          const list = result?.result?.list ?? [];
          CheckUtil.expectEqual(
            list.length,
            TOTAL,
            `_onlyId+needObj 应返回全部${TOTAL}条，实际=${list.length}`
          );
          const ids = list.map((r: any) => r.testNumId).sort((a: number, b: number) => a - b);
          CheckUtil.expectEqual(
            JSON.stringify(ids),
            JSON.stringify(variable.schIdsIds),
            `主键应对上，实际=${JSON.stringify(ids)}`
          );
          for (const row of list) {
            CheckUtil.expectEqual(
              row.linked == null,
              true,
              `_onlyId 不应跑 _processList，row=${JSON.stringify(row)}`
            );
            CheckUtil.expectEqual(
              row.testNumId != null,
              true,
              `应含主键 testNumId，row=${JSON.stringify(row)}`
            );
          }
        }
      }),

      new HttpAction({
        remark: `SchIds+_notInIds 反选(getTableName)：排除前${EXCLUDE_CNT}个，应剩${TOTAL - EXCLUDE_CNT}个`,
        name: 'SchIds反选排除-Table',
        url: '/free/tests/processSchIdsByTable',
        method: 'POST',
        param: {
          _schParam: {
            name: NAME_PREFIX,
            pageSize: PAGE_SIZE,
            pageNo: 1,
            _notInIds: '${schIdsExcludeIds}'
          }
        }
      }, {
        check(result) {
          const expectIds = (variable.schIdsAfterExclude ?? []).slice().sort((a: number, b: number) => a - b);
          const ids = (result?.result?.ids ?? []).slice().sort((a: number, b: number) => a - b);
          CheckUtil.expectEqual(
            ids.length,
            TOTAL - EXCLUDE_CNT,
            `_notInIds(Table) 排除后应剩${TOTAL - EXCLUDE_CNT}个，实际=${JSON.stringify(ids)}`
          );
          CheckUtil.expectEqual(
            JSON.stringify(ids),
            JSON.stringify(expectIds),
            `反选后 ids 应对上，实际=${JSON.stringify(ids)} expect=${JSON.stringify(expectIds)}`
          );
        }
      }),

      new HttpAction({
        remark: `SchIds+_notInIds 反选(getDao+needObj)：排除前${EXCLUDE_CNT}个，应剩${TOTAL - EXCLUDE_CNT}个对象`,
        name: 'SchIds反选排除-Dao',
        url: '/free/tests/processSchIdsByDao',
        method: 'POST',
        param: {
          _schParam: {
            name: NAME_PREFIX,
            pageSize: PAGE_SIZE,
            pageNo: 1,
            _notInIds: '${schIdsExcludeIds}'
          }
        }
      }, {
        check(result) {
          const expectIds = (variable.schIdsAfterExclude ?? []).slice().sort((a: number, b: number) => a - b);
          const list = result?.result?.list ?? [];
          const ids = list.map((r: any) => r.testNumId).sort((a: number, b: number) => a - b);
          CheckUtil.expectEqual(
            list.length,
            TOTAL - EXCLUDE_CNT,
            `_notInIds(Dao) 排除后应剩${TOTAL - EXCLUDE_CNT}条，实际=${list.length}`
          );
          CheckUtil.expectEqual(
            JSON.stringify(ids),
            JSON.stringify(expectIds),
            `反选后主键应对上，实际=${JSON.stringify(ids)} expect=${JSON.stringify(expectIds)}`
          );
          for (const row of list) {
            CheckUtil.expectEqual(
              row.linked == null,
              true,
              `_onlyId 不应跑 _processList，row=${JSON.stringify(row)}`
            );
          }
        }
      }),

      new HttpAction({
        remark: '无 _schParam 时 SchIds 不改写，ids 为空',
        name: 'SchIds无查询条件',
        url: '/free/tests/processSchIdsByTable',
        method: 'POST',
        param: {}
      }, {
        check(result) {
          CheckUtil.expectEqual(
            result?.result?.ids == null,
            true,
            `无 _schParam 时 ids 应为 null/undefined，实际=${JSON.stringify(result?.result)}`
          );
        }
      }),

      new HttpAction({
        remark: '按插入 id 删除本次测试数据',
        name: '清理测试数据',
        url: '/free/del',
        method: 'POST',
        param: {
          table: 'testNum',
          query: { testNumId: '${schIdsIds}' }
        }
      })
    ];
  }

  /**
   * 按 pageNo=1..PAGE_CNT 翻页，校验每页条数、有关联、页间不重复；
   * 翻完后并集应等于全部插入 id；首页=最小 PAGE_SIZE 个，末页=最大 PAGE_SIZE 个。
   */
  private buildFlipPages(tag: string, url: string, variable: any): BaseTest[] {
    const actions: BaseTest[] = [];
    const flipKey = `schIdsFlip${tag}`;

    for (let pageNo = 1; pageNo <= PAGE_CNT; pageNo++) {
      const isFirst = pageNo === 1;
      const isLast = pageNo === PAGE_CNT;
      actions.push(new HttpAction({
        remark: `普通列表${tag}：第${pageNo}/${PAGE_CNT}页 pageSize=${PAGE_SIZE}${isFirst ? '（首页）' : ''}${isLast ? '（末页）' : ''}`,
        name: `翻页${tag}-第${pageNo}页`,
        url,
        method: 'POST',
        param: {
          name: NAME_PREFIX,
          pageSize: PAGE_SIZE,
          pageNo,
          orderBy: 'testNumId'
        }
      }, {
        check(result) {
          const content = result?.result?.content ?? [];
          CheckUtil.expectEqual(
            content.length,
            PAGE_SIZE,
            `${tag}第${pageNo}页应返回${PAGE_SIZE}条，实际=${content.length}`
          );
          CheckUtil.expectEqual(result?.result?.pageSize, PAGE_SIZE, 'pageSize 应对上');
          for (const row of content) {
            CheckUtil.expectEqual(row.linked, true, `应跑关联 _processList，row=${JSON.stringify(row)}`);
          }

          const pageIds = content.map((r: any) => r.testNumId);
          if (isFirst) {
            variable[flipKey] = [];
          }
          const seen: number[] = variable[flipKey] ?? [];
          for (const id of pageIds) {
            CheckUtil.expectEqual(
              seen.includes(id),
              false,
              `${tag}第${pageNo}页 id=${id} 与前面页重复`
            );
          }
          variable[flipKey] = seen.concat(pageIds);

          const allSorted = (variable.schIdsIds ?? []).slice().sort((a: number, b: number) => a - b);
          if (isFirst) {
            const expectFirst = allSorted.slice(0, PAGE_SIZE);
            CheckUtil.expectEqual(
              JSON.stringify(pageIds),
              JSON.stringify(expectFirst),
              `${tag}首页应按 testNumId 升序取最小${PAGE_SIZE}个，实际=${JSON.stringify(pageIds)}`
            );
          }
          if (isLast) {
            const expectLast = allSorted.slice(-PAGE_SIZE);
            CheckUtil.expectEqual(
              JSON.stringify(pageIds),
              JSON.stringify(expectLast),
              `${tag}末页应按 testNumId 升序取最大${PAGE_SIZE}个，实际=${JSON.stringify(pageIds)}`
            );
            const flipped = (variable[flipKey] ?? []).slice().sort((a: number, b: number) => a - b);
            CheckUtil.expectEqual(
              flipped.length,
              TOTAL,
              `${tag}翻完${PAGE_CNT}页应覆盖全部${TOTAL}条，实际=${flipped.length}`
            );
            CheckUtil.expectEqual(
              JSON.stringify(flipped),
              JSON.stringify(allSorted),
              `${tag}翻页并集应对上全部 id`
            );
          }
        }
      }));
    }
    return actions;
  }
}

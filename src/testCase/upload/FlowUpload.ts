import { ArrayUtil, BaseTest, CheckUtil, MultiSheetDownloadAction, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import Upload from "../../action/Upload";
import path from "path";
import Action from "../../action/Action";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import StockUtil from "../../util/StockUtil";
import Recal from "../../action/Recal";
import GetMap from "../../action/GetMap";
import CheckStock from "../../action/CheckStock";
import ExcelUploadUtil from "../../util/ExcelUploadUtil";

/** 与 FlowUpload.md / excel 一致的固定日期 */
const DAY_0731 = '2026-07-31';
const DAY_0815 = '2026-08-15';
const DAY_0816 = '2026-08-16';
const DAY_0831 = '2026-08-31';
const PSI_SHEET = '总计';

/**
 * 按 FlowUpload.md：白酒前置、物料、订单、盘点、bom、销售、进销存
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '按 FlowUpload.md 全流程：物料 + 订单 + 盘点 + bom + 销售 + 进销存' });
  }

  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    if (!strPath.startsWith('[FU]')) {
      strPath = '[FU]' + strPath;
    }
    return path.join(__dirname, '../../../excel/upload/', strPath);
  }

  getName(): string {
    return '上传'
  }

  /**
   * 上传后默认挂 saveExcel；列未全部匹配（allMap=false）时才真正执行 saveExcel。
   */
  private buildUploadAndSave(
    name: string,
    target: string,
    fileName: string,
    checkImport?: (importResult: any, topResult?: any) => void
  ): BaseTest[] {
    return [
      new Upload({
        name,
        param: {
          target,
          warehouseId: '${warehouse.warehouseId}',
        },
        filePath: this.getFile(fileName)
      }, {
        buildVariable(result) {
          let data = result.result ?? {};
          return {
            excelFileId: data.excelFileId,
            fileCols: ExcelUploadUtil.buildSaveFileCols(data.fileCols),
            allMap: !!data.allMap
          };
        },
        check(result) {
          let data = result.result;
          if (data?.allMap && checkImport) {
            checkImport(data.importResult, data);
          }
        }
      }),
      new Action({
        name: `saveExcel[${name}]`,
        remark: '列未全部自动匹配时再保存导入',
        url: '/app/excel/saveExcel',
        param: {
          excelFileId: '${excelFileId}',
          fileCols: '${fileCols}',
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        needRunVariable: {
          key: 'allMap',
          not: true
        },
        check(result) {
          if (checkImport) {
            checkImport(result.result);
          }
        }
      })
    ];
  }

  private checkFailImport(importResult: any) {
    CheckUtil.expectEqual(importResult?.checked, false, '存在错误行时应 checked=false');
    let errors: any[] = importResult?.errors ?? [];
    CheckUtil.expectEqual(errors.length > 0, true, '应返回 errors');
    for (let err of errors) {
      CheckUtil.expectEqual(err.errorCode != null && err.errorCode !== '', true, 'errorCode 不应为空');
      let btns: any[] = err.btns ?? [];
      if (err.errorCode === 'noMaterial') {
        CheckUtil.expectEqual(btns.length, 1);
        CheckUtil.expectEqual(btns[0].value, 'downloadExcelMaterial');
      } else if (err.errorCode === 'noProduct') {
        CheckUtil.expectEqual(btns.length, 1);
        CheckUtil.expectEqual(btns[0].value, 'downloadExcelProduct');
      } else if (err.errorCode === 'noSupplier') {
        CheckUtil.expectEqual(btns.length, 1);
        CheckUtil.expectEqual(btns[0].value, 'downloadExcelSupplier');
      } else {
        CheckUtil.expectEqual(btns.length, 1, `${err.errorCode} 应仅有一个按钮`);
        CheckUtil.expectEqual(btns[0].value, 'downloadExcelError');
      }
    }
  }

  private checkMaterialSuccImport(importResult: any, topResult?: any) {
    CheckUtil.expectEqual(importResult?.checked, true, '成功上传 checked 应为 true');
    let succMsg = topResult?.succMsg ?? importResult?.succMsg;
    CheckUtil.expectEqual(succMsg, '一共上传了2条物料。');
  }

  private checkOrderSuccImport(importResult: any, topResult?: any) {
    CheckUtil.expectEqual(importResult?.checked, true, '订单上传成功 checked 应为 true');
    let succMsg = topResult?.succMsg ?? importResult?.succMsg;
    CheckUtil.expectEqual(succMsg != null && succMsg !== '', true, '应返回 succMsg');
    CheckUtil.expectEqual(String(succMsg).includes('一共上传了4条物料'), true, `succMsg应含4条物料，实际=${succMsg}`);
    CheckUtil.expectEqual(String(succMsg).includes('共2个订单'), true, `succMsg应含2个订单，实际=${succMsg}`);
    CheckUtil.expectEqual(String(succMsg).includes('金额为802'), true, `succMsg应含金额802，实际=${succMsg}`);
  }

  private checkInventorySuccImport(expectedCnt: number) {
    return (importResult: any, topResult?: any) => {
      CheckUtil.expectEqual(importResult?.checked, true, '盘点上传成功 checked 应为 true');
      let succMsg = topResult?.succMsg ?? importResult?.succMsg;
      CheckUtil.expectEqual(succMsg != null && succMsg !== '', true, '应返回 succMsg');
      CheckUtil.expectEqual(
        String(succMsg).includes(`一共上传了${expectedCnt}条盘点记录`),
        true,
        `succMsg应含${expectedCnt}条盘点，实际=${succMsg}`
      );
    };
  }

  private findMaterial(content: any[], name: string) {
    let material = content.find(row => row.name === name);
    CheckUtil.expectEqual(material != null, true, `未找到物料 ${name}`);
    return material;
  }

  private getStallNames(material: any): string[] {
    let list: any[] = material.stallMaterials ?? [];
    return list
      .filter(row => row.stall != null && row.stall.isAll != 1)
      .map(row => row.stall.name);
  }

  private checkMaterialRow(material: any, opt: {
    name: string;
    price: number;
    priceBuyUnitFee?: number;
    category: string;
    supplier: string;
    stalls: string[];
  }) {
    CheckUtil.expectEqual(material.category?.name, opt.category, `${opt.name} 分类`);
    CheckUtil.expectEqual(material.supplier?.name, opt.supplier, `${opt.name} 供应商`);
    let sm = material.supplierMaterial;
    CheckUtil.expectEqual(sm != null, true, `${opt.name} 应有 supplierMaterial`);
    CheckUtil.expectEqual(
      StockUtil.isEqPrice(
        { price: sm.price, buyUnitFee: sm.buyUnitFee ?? 1 },
        { price: opt.price, buyUnitFee: opt.priceBuyUnitFee ?? sm.buyUnitFee ?? 1 }
      ),
      true,
      `${opt.name} 价格不对`
    );
    let stallNames = this.getStallNames(material);
    for (let stall of opt.stalls) {
      CheckUtil.expectEqual(stallNames.includes(stall), true, `${opt.name} 应含档口 ${stall}，实际=${stallNames.join(',')}`);
    }
  }

  /** 餐厅上传订单：instockTime 为订单日期，其余操作时间不写 */
  private checkNoteInstockTime(note: any, name: string, day: string) {
    CheckUtil.expectEqual(
      String(note?.instockTime ?? '').substring(0, 10),
      day,
      `${name} 订单 instockTime 应为 ${day}，实际=${note?.instockTime}`
    );
    for (let col of ['acceptTime', 'pickTime', 'sendTime', 'outstockTime', 'statementTime']) {
      CheckUtil.expectEqual(
        note?.[col] == null || note?.[col] === '',
        true,
        `${name} 订单 ${col} 应为空，实际=${note?.[col]}`
      );
    }
  }

  private checkNoteItemRow(row: any, opt: {
    name: string;
    price: number;
    priceBuyUnitFee: number;
    cnt: number;
    cntBuyUnitFee: number;
    instockCost: number;
    instockDay?: string;
  }) {
    CheckUtil.expectEqual(row != null, true, `应有${opt.name}`);
    let sm = row.supplierMaterial;
    CheckUtil.expectEqual(sm != null, true, `${opt.name} 应有 supplierMaterial`);
    CheckUtil.expectEqual(
      StockUtil.isEqPrice(
        { price: sm.price, buyUnitFee: sm.buyUnitFee },
        { price: opt.price, buyUnitFee: opt.priceBuyUnitFee }
      ),
      true,
      `${opt.name} 价格不对`
    );
    CheckUtil.expectEqual(row.instock != null, true, `${opt.name} 应有 instock`);
    CheckUtil.expectEqual(
      StockUtil.isEq(
        { cnt: row.instock.cnt, buyUnitFee: row.instock.buyUnitFee },
        { cnt: opt.cnt, buyUnitFee: opt.cntBuyUnitFee }
      ),
      true,
      `${opt.name} 数量不对`
    );
    CheckUtil.expectEqual(row.instockCost ?? row.cost, opt.instockCost, `${opt.name} 金额`);
    if (opt.instockDay != null) {
      CheckUtil.expectEqual(
        Number(row.instockUser),
        Number(this.getVariable().usersId),
        `${opt.name} instockUser 应为当前用户`
      );
      CheckUtil.expectEqual(
        String(row.instockTime ?? '').substring(0, 10),
        opt.instockDay,
        `${opt.name} instockTime 应为 ${opt.instockDay}`
      );
    }
  }

  private checkInventoryQty(row: any, opt: {
    name: string;
    cnt: number;
    buyUnitFee: number;
  }) {
    CheckUtil.expectEqual(row != null, true, `应有盘点 ${opt.name}`);
    CheckUtil.expectEqual(
      StockUtil.isEq(
        { cnt: row.inventory?.cnt, buyUnitFee: row.inventory?.buyUnitFee },
        { cnt: opt.cnt, buyUnitFee: opt.buyUnitFee }
      ),
      true,
      `${opt.name} 盘点数量不对，实际 cnt=${row.inventory?.cnt} fee=${row.inventory?.buyUnitFee}`
    );
  }

  /** 按盘点日筛选 inventory 行（isDel=0） */
  private filterInventoryByDay(list: any[], day: string): any[] {
    return (list ?? []).filter(row =>
      row.isDel != 1 && String(row.inventoryDay ?? '').indexOf(day) >= 0
    );
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId().setRemark('查找最大测试用户'),
      new GetOpenId().setRemark('注册测试用户'),
      new AddWarehouse().setRemark('新建餐厅仓库'),
      new ChangeWarehouse().setRemark('切换到新建仓库'),

      new Action({
        name: '新增分类：酒精',
        url: '/app/category/addCategory',
        param: { name: '酒精' }
      }),
      new Action({
        name: '查询分类',
        url: '/app/category/listCategory',
        param: {}
      }, {
        buildVariable(result) {
          let content = result.result.content;
          return {
            categoryMap: ArrayUtil.toMapByKey(content, 'name', 'categoryId')
          };
        }
      }),

      new Action({
        name: '新增物料[白酒]',
        remark: '白酒（瓶），分类酒精',
        url: '/app/material/SaveMaterial',
        method: 'POST',
        param: {
          name: '白酒',
          remark: '',
          img: [],
          buyUnit: [
            { isSupplier: true, name: '瓶', fee: 1 }
          ],
          category: { categoryId: '${categoryMap.酒精}' },
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          return {
            baijiuMaterialId: result.result.materialId
          };
        },
        check(result) {
          CheckUtil.expectEqual(result.result?.materialId != null, true, 'SaveMaterial 应返回 materialId');
        }
      }),

      new Action({
        name: '更改物料规格[白酒1瓶=500ml]',
        remark: 'saveBuyUnit：毫升+瓶，1瓶=500毫升',
        url: '/app/material/saveBuyUnit',
        param: {
          materialId: '${baijiuMaterialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          buyUnit: [
            { name: '毫升', fee: 1 },
            { name: '瓶', fee: 500, isSupplier: true }
          ],
          supplierUnitsName: '瓶'
        }
      }),

      ...this.buildUploadAndSave(
        '上传物料[失败]',
        'material',
        '上传物料失败',
        (importResult) => this.checkFailImport(importResult)
      ),

      new Action({
        name: '校验失败上传后的物料',
        remark: '预计：啤酒、汽水失败未入库；可乐成功入库；白酒前置已存在',
        url: '/app/material/listMaterialByCategory',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          let names = content.map(row => row.name);
          CheckUtil.expectEqual(names.includes('啤酒'), false, '啤酒应失败未入库');
          CheckUtil.expectEqual(names.includes('汽水'), false, '汽水应失败未入库');
          CheckUtil.expectEqual(names.includes('可乐'), true, '可乐应成功入库');
          CheckUtil.expectEqual(names.includes('白酒'), true, '白酒应已前置创建');
        }
      }),

      ...this.buildUploadAndSave(
        '上传物料[成功]',
        'material',
        '上传物料成功',
        (importResult, topResult) => this.checkMaterialSuccImport(importResult, topResult)
      ),

      new Action({
        name: '验证物料价格分类档口供应商',
        remark: '校验啤酒/汽水/可乐的价格、分类、档口、供应商',
        url: '/app/material/listMaterialByCategory',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          this.checkMaterialRow(this.findMaterial(content, '啤酒'), {
            name: '啤酒',
            price: 10,
            category: '酒精',
            supplier: '供应商1',
            stalls: ['酒类', '前台']
          });
          this.checkMaterialRow(this.findMaterial(content, '汽水'), {
            name: '汽水',
            price: 10,
            category: '酒精',
            supplier: '供应商1',
            stalls: ['酒类']
          });
          this.checkMaterialRow(this.findMaterial(content, '可乐'), {
            name: '可乐',
            price: 12,
            category: '饮料',
            supplier: '供应商2',
            stalls: ['酒类', '饮料']
          });
        }
      }),

      ...this.buildUploadAndSave(
        '上传订单[失败-单位]',
        'purcharse',
        '上传订单失败_单位',
        (importResult) => this.checkFailImport(importResult)
      ),

      new Action({
        name: '校验单位错误后无订单',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 0, '单位错误整批失败，不应产生订单');
        }
      }),

      ...this.buildUploadAndSave(
        '上传订单[失败-供应商]',
        'purcharse',
        '上传订单失败_供应商',
        (importResult) => this.checkFailImport(importResult)
      ),

      new Action({
        name: '校验供应商错误后无订单',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 0, '供应商错误整批失败，不应产生订单');
        }
      }),

      ...this.buildUploadAndSave(
        '上传订单[成功]',
        'purcharse',
        '上传订单成功',
        (importResult, topResult) => this.checkOrderSuccImport(importResult, topResult)
      ),

      new Action({
        name: '校验成功订单列表',
        remark: '应产生2个订单：供应商2@2026-08-01(啤酒+白酒)、供应商1@2026-08-02(汽水+可乐)',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 2, '应产生2个订单');
          let noteBaijiu = content.find(row => row.cost === 152);
          let noteCola = content.find(row => row.cost === 650);
          CheckUtil.expectEqual(noteBaijiu != null, true, '应有啤酒+白酒订单金额152');
          CheckUtil.expectEqual(noteCola != null, true, '应有汽水+可乐订单金额650');
          CheckUtil.expectEqual(noteBaijiu?.materialCnt, 2, '啤酒+白酒应为2条物料');
          CheckUtil.expectEqual(noteCola?.materialCnt, 2, '汽水+可乐应为2条物料');
          this.checkNoteInstockTime(noteBaijiu, '啤酒+白酒', '2026-08-01');
          this.checkNoteInstockTime(noteCola, '汽水+可乐', '2026-08-02');
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          return {
            noteIds: ArrayUtil.toArray(content, 'noteId')
          };
        }
      }),

      new Action({
        name: '校验成功订单物料',
        remark: '价格取 supplierMaterial，数量取 instock；校验 instockUser/instockTime',
        url: '/app/noteItem/listNoteItem',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          noteId: '${noteIds}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 4, '应有4条订单物料');
          this.checkNoteItemRow(content.find(row => row.name === '啤酒'), {
            name: '啤酒',
            price: 12,
            priceBuyUnitFee: -1000,
            cnt: 10,
            cntBuyUnitFee: -1000,
            instockCost: 120,
            instockDay: '2026-08-01'
          });
          this.checkNoteItemRow(content.find(row => row.name === '白酒'), {
            name: '白酒',
            // 标准单位=瓶；1瓶=500ml，buyUnitFee=500 表示 ml；8升=8000ml；4元/升 → fee=-2（1升=2瓶）
            price: 4,
            priceBuyUnitFee: -2,
            cnt: 8000,
            cntBuyUnitFee: 500,
            instockCost: 32,
            instockDay: '2026-08-01'
          });
          this.checkNoteItemRow(content.find(row => row.name === '汽水'), {
            name: '汽水',
            price: 10,
            priceBuyUnitFee: 1,
            cnt: 20,
            cntBuyUnitFee: 1,
            instockCost: 200,
            instockDay: '2026-08-02'
          });
          this.checkNoteItemRow(content.find(row => row.name === '可乐'), {
            name: '可乐',
            price: 15,
            priceBuyUnitFee: -1000,
            cnt: 30,
            cntBuyUnitFee: -1000,
            instockCost: 450,
            instockDay: '2026-08-02'
          });
        }
      }),

      new Action({
        name: '设置啤酒物料编码',
        remark: '给啤酒写入 code=beer，供后续按编码匹配',
        url: '/free/update',
        param: {
          table: 'material',
          whereCdt: {
            name: '啤酒',
            warehouseGroupId: '${warehouse.warehouseGroupId}',
            isDel: 0
          },
          data: {
            code: 'beer'
          }
        }
      }),

      ...this.buildUploadAndSave(
        '上传订单[物料编码匹配]',
        'purcharse',
        '上传订单_物料编码',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '按编码匹配应上传成功');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg != null && succMsg !== '', true, '应返回 succMsg');
        }
      ),

      new Action({
        name: '校验编码匹配后的订单物料',
        remark: '名称「啤酒不存在」应按编码匹配到啤酒；数量1公斤、金额12',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          let note = content.find(row => row.cost === 12);
          CheckUtil.expectEqual(note != null, true, '应有按编码匹配的订单金额12');
          CheckUtil.expectEqual(note?.materialCnt, 1, '编码匹配订单应为1条物料');
          this.checkNoteInstockTime(note, '编码匹配', '2026-09-01');
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          let note = content.find(row => row.cost === 12);
          return {
            codeMatchNoteId: note?.noteId
          };
        }
      }),

      new Action({
        name: '校验编码匹配订单明细',
        url: '/app/noteItem/listNoteItem',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          noteId: '${codeMatchNoteId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, '编码匹配订单应有1条明细');
          CheckUtil.expectEqual(content[0]?.name, '啤酒', '应按编码匹配到啤酒，而不是啤酒不存在');
          this.checkNoteItemRow(content[0], {
            name: '啤酒',
            price: 12,
            priceBuyUnitFee: -1000,
            cnt: 1,
            cntBuyUnitFee: -1000,
            instockCost: 12
          });
        }
      }),

      new Action({
        name: '校验未新建错误物料名',
        url: '/app/material/listMaterialByCategory',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result?.content ?? [];
          let names = content.map(row => row.name);
          CheckUtil.expectEqual(names.includes('啤酒不存在'), false, '不应新建物料「啤酒不存在」');
          CheckUtil.expectEqual(names.includes('啤酒'), true, '啤酒应仍存在');
        }
      }),

      ...this.buildUploadAndSave(
        '上传盘点[失败-0731]',
        'inventory',
        '上传盘点失败',
        (importResult) => this.checkFailImport(importResult)
      ),

      new Action({
        name: '校验2026-07-31盘点失败后仅1条',
        remark: `${DAY_0731}只有白酒1条盘点`,
        url: '/free/query',
        param: {
          array: [{
            table: 'inventory',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        check: (result) => {
          let list = this.filterInventoryByDay(result.result?.inventory ?? [], DAY_0731);
          CheckUtil.expectEqual(list.length, 1, `${DAY_0731}应只有1条盘点`);
          CheckUtil.expectEqual(
            StockUtil.isEq(
              { cnt: list[0].cnt, buyUnitFee: list[0].buyUnitFee },
              { cnt: 2000, buyUnitFee: 500 }
            ),
            true,
            `白酒盘点数量应为2升(2000ml)，实际 cnt=${list[0].cnt} fee=${list[0].buyUnitFee}`
          );
        }
      }),

      ...this.buildUploadAndSave(
        '上传盘点[成功-0731]',
        'inventory',
        '上传盘点成功',
        this.checkInventorySuccImport(2)
      ),

      new Action({
        name: '校验2026-07-31盘点成功共3条',
        remark: `${DAY_0731}有白酒/啤酒/可乐共3条，校验数量`,
        url: '/app/inventory/listInventory',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 3, `${DAY_0731}盘点成功后应有3条盘点`);
          this.checkInventoryQty(content.find(row => row.name === '白酒'), {
            name: '白酒',
            cnt: 2000,
            buyUnitFee: 500
          });
          this.checkInventoryQty(content.find(row => row.name === '啤酒'), {
            name: '啤酒',
            cnt: 2,
            buyUnitFee: -500
          });
          this.checkInventoryQty(content.find(row => row.name === '可乐'), {
            name: '可乐',
            cnt: 2,
            buyUnitFee: -1000
          });
        }
      }),

      new GetMap({ tables: ['material'] }).setRemark('取物料Id供 CheckStock'),
      new Recal().setRemark('2026-07-31盘点后重算库存'),
      new CheckStock({
        array: [
          // 07-31盘点2升 + 08-01入库8升 = 10升 = 10000ml；标准单位瓶，fee=500 表示 ml
          { materialId: '${material.白酒}', cnt: 10000, buyUnitFee: 500 },
          // 07-31盘点2斤(1公斤) + 08-01入库10公斤 + 09-01按编码匹配入库1公斤
          { materialId: '${material.啤酒}', cnt: 12, buyUnitFee: -1000 },
          // 07-31盘点2瓶 + 08-02入库30瓶
          { materialId: '${material.可乐}', cnt: 32, buyUnitFee: -1000 },
          // 仅08-02入库20瓶
          { materialId: '${material.汽水}', cnt: 20, buyUnitFee: 1 },
        ]
      }).setRemark('校验重算后库存'),

      ...this.buildUploadAndSave(
        '上传盘点[失败-0831无物料]',
        'inventory',
        '上传盘点失败_无物料',
        (importResult) => this.checkFailImport(importResult)
      ),

      new Action({
        name: '校验2026-08-31盘点失败后仅3条',
        remark: `${DAY_0831}啤酒1失败，仅产生白酒/汽水/可乐共3条`,
        url: '/free/query',
        param: {
          array: [{
            table: 'inventory',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        check: (result) => {
          let list = this.filterInventoryByDay(result.result?.inventory ?? [], DAY_0831);
          CheckUtil.expectEqual(list.length, 3, `${DAY_0831}应只产生3条盘点`);
        }
      }),

      ...this.buildUploadAndSave(
        '上传盘点[成功-0831]',
        'inventory',
        '上传盘点成功_0831',
        this.checkInventorySuccImport(4)
      ),

      new Action({
        name: '校验2026-08-31盘点成功共4条',
        remark: `${DAY_0831}产生啤酒/白酒/汽水/可乐共4条`,
        url: '/free/query',
        param: {
          array: [{
            table: 'inventory',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        check: (result) => {
          let list = this.filterInventoryByDay(result.result?.inventory ?? [], DAY_0831);
          CheckUtil.expectEqual(list.length, 4, `${DAY_0831}应产生4条盘点`);
        }
      }),

      new Action({
        name: '校验0831盘点最新数量',
        remark: 'listInventory 最新：啤酒5公斤、白酒4升、汽水10瓶、可乐12瓶',
        url: '/app/inventory/listInventory',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 4, '最新盘点应有4个物料');
          this.checkInventoryQty(content.find(row => row.name === '啤酒'), {
            name: '啤酒',
            cnt: 5,
            buyUnitFee: -1000
          });
          this.checkInventoryQty(content.find(row => row.name === '白酒'), {
            name: '白酒',
            cnt: 4000,
            buyUnitFee: 500
          });
          this.checkInventoryQty(content.find(row => row.name === '汽水'), {
            name: '汽水',
            cnt: 10,
            buyUnitFee: 1
          });
          this.checkInventoryQty(content.find(row => row.name === '可乐'), {
            name: '可乐',
            cnt: 12,
            buyUnitFee: -1000
          });
        }
      }),

      ...this.buildUploadAndSave(
        '上传bom[失败]',
        'bom',
        '上传bom失败',
        (importResult) => this.checkFailImport(importResult)
      ),

      new Action({
        name: '校验bom失败后仅1个餐品',
        remark: '仅好喝的汽水成功；难喝的汽水无采购单位应报错；鸡尾酒/可乐汽水因单位错误失败',
        url: '/app/product/listProduct',
        param: {
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, 'bom失败后应只产生1个餐品');
          CheckUtil.expectEqual(content[0]?.name, '好喝的汽水', '唯一餐品应为好喝的汽水');
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          return {
            productMap: ArrayUtil.toMapByKey(content, 'name', 'productId')
          };
        }
      }),

      new Action({
        name: '校验好喝的汽水bom采购单位',
        remark: '有采购单位则价格按采购单位；好喝的汽水采购单位=箱、单价=10（相对瓶 fee=-10）',
        url: '/app/bom/listBom',
        param: {
          productId: '${productMap.好喝的汽水}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, '好喝的汽水应有1条bom');
          let bom = content[0];
          CheckUtil.expectEqual(bom.name === '汽水' || bom.material?.name === '汽水', true, 'bom物料应为汽水');
          CheckUtil.expectEqual(
            StockUtil.isEqPrice(
              { price: bom.price, buyUnitFee: bom.stockBuyUnitFee },
              { price: 10, buyUnitFee: -10 }
            ),
            true,
            `采购价应为10元/箱(fee=-10)，实际 price=${bom.price} fee=${bom.stockBuyUnitFee}`
          );
        }
      }),

      ...this.buildUploadAndSave(
        '上传bom[成功]',
        'bom',
        '上传bom成功',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, 'bom成功上传 checked 应为 true');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg != null && succMsg !== '', true, '应返回 succMsg');
          CheckUtil.expectEqual(
            String(succMsg).includes('一共上传了'),
            true,
            `succMsg应含上传条数，实际=${succMsg}`
          );
          CheckUtil.expectEqual(
            String(succMsg).includes('共3个菜品'),
            true,
            `succMsg应含共3个菜品，实际=${succMsg}`
          );
        }
      ),

      new Action({
        name: '校验bom成功后的餐品',
        remark: '应有鸡尾酒、可乐汽水、好喝的汽水',
        url: '/app/product/listProduct',
        param: {
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result?.content ?? [];
          let names = content.map(row => row.name);
          CheckUtil.expectEqual(names.includes('好喝的汽水'), true, '应有好喝的汽水');
          CheckUtil.expectEqual(names.includes('鸡尾酒'), true, '应有鸡尾酒');
          CheckUtil.expectEqual(names.includes('可乐汽水'), true, '应有可乐汽水');
          CheckUtil.expectEqual(names.includes('难喝的汽水'), false, '难喝的汽水不应存在');
          CheckUtil.expectEqual(content.length, 3, 'bom成功后应有3个餐品');
        }
      }),

      ...this.buildUploadAndSave(
        '上传销售[失败]',
        'salesRecord',
        '上传销售失败',
        (importResult) => this.checkFailImport(importResult)
      ),

      new Action({
        name: '校验销售失败后的记录',
        remark: '鸡尾酒1失败；部分成功导入可乐汽水@08-15、好喝的汽水@08-16（与盘点部分成功一致）',
        url: '/app/salesRecord/listSalesRecord',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 2, '销售失败后应有2条（不含鸡尾酒1）');
          let cola = content.find(row => row.product?.name === '可乐汽水');
          let soda = content.find(row => row.product?.name === '好喝的汽水');
          CheckUtil.expectEqual(cola != null, true, '应有可乐汽水');
          CheckUtil.expectEqual(soda != null, true, '应有好喝的汽水');
          CheckUtil.expectEqual(String(cola?.salesDate ?? '').indexOf(DAY_0815) >= 0, true, '可乐汽水应为08-15');
          CheckUtil.expectEqual(cola?.cnt, 12, '可乐汽水数量应为12');
          CheckUtil.expectEqual(String(soda?.salesDate ?? '').indexOf(DAY_0816) >= 0, true, '好喝的汽水应为08-16');
          CheckUtil.expectEqual(soda?.cnt, 3, '好喝的汽水数量应为3');
          CheckUtil.expectEqual(
            content.some(row => row.product?.name === '鸡尾酒' || row.product?.name === '鸡尾酒1'),
            false,
            '不应有鸡尾酒/鸡尾酒1'
          );
        }
      }),

      ...this.buildUploadAndSave(
        '上传销售[成功]',
        'salesRecord',
        '上传销售成功',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '销售成功上传 checked 应为 true');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg != null && succMsg !== '', true, '应返回 succMsg');
          CheckUtil.expectEqual(
            String(succMsg).includes('一共上传了3条销售记录'),
            true,
            `succMsg应含3条销售记录，实际=${succMsg}`
          );
          CheckUtil.expectEqual(
            String(succMsg).includes('共2天'),
            true,
            `succMsg应含共2天，实际=${succMsg}`
          );
        }
      ),

      new Action({
        name: '校验销售成功后的记录',
        remark: '鸡尾酒1份@08-15、可乐汽水2份@08-15、好喝的汽水2份@08-16',
        url: '/app/salesRecord/listSalesRecord',
        param: {
          warehouseId: '${warehouse.warehouseId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 3, '销售成功后应有3条');
          let cocktail = content.find(row => row.product?.name === '鸡尾酒');
          let cola = content.find(row => row.product?.name === '可乐汽水');
          let soda = content.find(row => row.product?.name === '好喝的汽水');
          CheckUtil.expectEqual(cocktail != null, true, '应有鸡尾酒');
          CheckUtil.expectEqual(cola != null, true, '应有可乐汽水');
          CheckUtil.expectEqual(soda != null, true, '应有好喝的汽水');
          CheckUtil.expectEqual(cocktail?.cnt, 1, '鸡尾酒数量应为1');
          CheckUtil.expectEqual(String(cocktail?.salesDate ?? '').indexOf(DAY_0815) >= 0, true, '鸡尾酒应为08-15');
          CheckUtil.expectEqual(cola?.cnt, 2, '可乐汽水数量应为2（覆盖失败上传的12）');
          CheckUtil.expectEqual(String(cola?.salesDate ?? '').indexOf(DAY_0815) >= 0, true, '可乐汽水应为08-15');
          CheckUtil.expectEqual(soda?.cnt, 2, '好喝的汽水数量应为2（覆盖失败上传的3）');
          CheckUtil.expectEqual(String(soda?.salesDate ?? '').indexOf(DAY_0816) >= 0, true, '好喝的汽水应为08-16');
        }
      }),

      new Recal().setRemark('销售后重算库存，再下进销存'),
      this.buildPsiCheck(),

      // 放在进销存之后，避免多出的采购影响 07-31 后 CheckStock / 八月 psi
      ...this.buildUploadAndSave(
        '上传订单[重复物料]',
        'purcharse',
        '上传订单_重复物料',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '重复物料上传 checked 应为 true');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg, '一共上传了1条物料，共1个订单，金额为78。');
        }
      ),

      new Action({
        name: '校验重复物料合并后的订单',
        remark: '同供应商同日期啤酒两行合并为1条，金额78',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          let note = content.find(row => Number(row.cost) === 78);
          CheckUtil.expectEqual(note != null, true, '应有重复物料合并订单金额78');
          CheckUtil.expectEqual(note?.materialCnt, 1, '合并后应为1条物料');
          this.checkNoteInstockTime(note, '重复物料', '2026-09-10');
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          let note = content.find(row => Number(row.cost) === 78);
          return {
            dupNoteId: note?.noteId
          };
        }
      }),

      new Action({
        name: '校验重复物料合并明细与入库操作人时间',
        remark: '数量累加、金额倒算价；instockUser=当前用户，instockTime=订单日期',
        url: '/app/noteItem/listNoteItem',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          noteId: '${dupNoteId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, '合并后应只有1条明细');
          this.checkNoteItemRow(content[0], {
            name: '啤酒合并',
            price: 15.6,
            priceBuyUnitFee: -1000,
            cnt: 5,
            cntBuyUnitFee: -1000,
            instockCost: 78,
            instockDay: '2026-09-10'
          });
        }
      }),
    ];
  }

  /**
   * 八月进销存：全部物料在「总计」；无分类类型时另有「未设置类型分类的物料」sheet。
   * 数量按默认采购单位（瓶）：期初=07-31盘点；采购=订单；期末=08-31盘点；出库=期初+采购-期末。
   */
  private buildPsiCheck(): BaseTest {
    let expects: any = {
      啤酒: {
        '期初数量': 2, '采购数量': 20, '出库数量': 12, '期末数量': 10,
        '采购金额': 120, '采购单价': 6
      },
      白酒: {
        '期初数量': 4, '采购数量': 16, '出库数量': 12, '期末数量': 8,
        '采购金额': 32, '采购单价': 2
      },
      汽水: {
        '期初数量': 0, '采购数量': 20, '出库数量': 10, '期末数量': 10,
        '采购金额': 200, '采购单价': 10
      },
      可乐: {
        '期初数量': 2, '采购数量': 30, '出库数量': 20, '期末数量': 12,
        '采购金额': 450, '采购单价': 15
      }
    };
    let sumExpects = {
      '采购金额': 802
    };
    return new MultiSheetDownloadAction({
      name: '校验八月进销存',
      remark: `下载 psi（08-01~08-31）全部 sheet，核对「${PSI_SHEET}」4物料数量与采购金额`,
      url: '/app/state/psi',
      highlight: true,
      param: {
        begin: '2026-08-01',
        end: '2026-08-31',
        warehouseId: '${warehouse.warehouseId}',
        warehouseGroupId: '${warehouse.warehouseGroupId}'
      }
    }, {
      check(sheets: any) {
        let sheetNames = Object.keys(sheets ?? {});
        CheckUtil.expectEqual(sheetNames[0], PSI_SHEET,
          `第一个sheet应为「${PSI_SHEET}」，实际=${JSON.stringify(sheetNames)}`);
        let rows: any[] = sheets?.[PSI_SHEET];
        CheckUtil.expectEqual(rows != null, true,
          `缺少sheet「${PSI_SHEET}」，实际=${JSON.stringify(sheetNames)}`);
        CheckUtil.expectEqual(rows.length >= 5, true, `进销存至少4物料+1汇总，实际${rows.length}`);
        for (let name in expects) {
          let row = rows.find(r => r['物料名称'] == name);
          CheckUtil.expectEqual(row != null, true, `进销存缺少${name}行`);
          let expect = expects[name];
          for (let col in expect) {
            CheckUtil.expectEqual(row[col], expect[col],
              `进销存:${name}.${col}，期望${expect[col]}，实际${row?.[col]}`);
          }
        }
        let sumRow = rows.find(r => r['物料名称'] == '汇总');
        CheckUtil.expectEqual(sumRow != null, true, '进销存缺少汇总行');
        for (let col in sumExpects) {
          CheckUtil.expectEqual(sumRow[col], sumExpects[col],
            `进销存:汇总.${col}，期望${sumExpects[col]}，实际${sumRow?.[col]}`);
        }
      }
    });
  }
}

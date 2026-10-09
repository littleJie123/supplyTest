import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import FindLastUserId from "../../action/user/FindLastUserId";
import GetOpenId from "../../action/user/GetOpenId";
import AddWarehouse from "../../action/warehouse/AddWarehouse";
import Upload from "../../action/Upload";
import path from "path";
import Action from "../../action/Action";
import ChangeWarehouse from "../../action/user/ChangeWarehouse";
import CheckArray from "../../action/CheckArray";
import ExcelUploadUtil from "../../util/ExcelUploadUtil";
import StockUtil from "../../util/StockUtil";
import { AddWarehouseUsers } from "../user/AddWarehouseUsers";

/** 盘点在发货数量之上再加的数量，保证扣减后库存仍大于 0 */
const INIT_EXTRA = 100;

/** 盘点记在昨天，addByArray 会落到当天 23:59，早于今天的发货流水 */
function inventoryDay() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

class SaveLogin extends BaseTest {
  private tokenKey: string;
  private usersKey: string;

  constructor(tokenKey: string, usersKey: string) {
    super();
    this.tokenKey = tokenKey;
    this.usersKey = usersKey;
    this.remark = '记下当前登录用户与仓库';
  }

  getName(): string {
    return '保存当前登录';
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    let variable = this.getVariable();
    return {
      [this.tokenKey]: variable.token,
      [this.usersKey]: variable.usersId,
      // GetOpenId 注册其他用户会覆盖 warehouse，这里一并保存供切回
      mainWarehouse: variable.warehouse
    };
  }
}

class UseLogin extends BaseTest {
  private tokenKey: string;
  private usersKey?: string;

  constructor(tokenKey: string, usersKey?: string) {
    super();
    this.tokenKey = tokenKey;
    this.usersKey = usersKey;
    this.remark = `切换登录 ${tokenKey}`;
  }

  getName(): string {
    return `切换登录${this.tokenKey}`;
  }

  protected async doTest(): Promise<any> {
  }

  protected buildVariable() {
    let variable = this.getVariable();
    let ret: any = {
      token: variable[this.tokenKey]
    };
    if (this.usersKey != null) {
      ret.usersId = variable[this.usersKey];
    }
    if (variable.mainWarehouse != null) {
      ret.warehouse = variable.mainWarehouse;
    }
    return ret;
  }
}

/**
 * 按 FlowUpload4Supplier.md：供应商端上传物料、餐厅、供应关系
 */
export default class extends TestCase {
  constructor() {
    super({ remark: '按 FlowUpload4Supplier.md：供应商物料、门店、供应关系、订单上传' });
  }

  protected getFile(strPath: string): string {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    if (!strPath.startsWith('[FUS]')) {
      strPath = '[FUS]' + strPath;
    }
    return path.join(__dirname, '../../../excel/upload4supplier/', strPath);
  }

  getName(): string {
    return '供应商上传'
  }

  /**
   * 上传后默认挂 saveExcel；列未全部匹配（allMap=false）时才真正执行 saveExcel。
   */
  private buildUploadAndSave(
    name: string,
    target: string,
    fileName: string,
    checkImport?: (importResult: any, topResult?: any) => void,
    buildImportVariable?: (importResult: any, topResult?: any) => any,
    extraParam?: any
  ): BaseTest[] {
    return [
      new Upload({
        name,
        param: {
          target,
          warehouseId: '${warehouse.warehouseId}',
          ...(extraParam ?? {})
        },
        filePath: this.getFile(fileName)
      }, {
        buildVariable(result) {
          let data = result.result ?? {};
          let importResult = data.allMap ? (data.importResult ?? {}) : {};
          let extra = buildImportVariable ? (buildImportVariable(importResult, data) ?? {}) : {};
          return {
            excelFileId: data.excelFileId,
            fileCols: ExcelUploadUtil.buildSaveFileCols(data.fileCols),
            allMap: !!data.allMap,
            ...extra
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
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          ...(extraParam ?? {})
        }
      }, {
        needRunVariable: {
          key: 'allMap',
          not: true
        },
        buildVariable(result) {
          if (!buildImportVariable) {
            return {};
          }
          let data = result.result ?? {};
          return buildImportVariable(data, data) ?? {};
        },
        check(result) {
          if (checkImport) {
            checkImport(result.result);
          }
        }
      })
    ];
  }

  private collectSmErrorVar(importResult: any, topResult?: any) {
    let errorNo = importResult?.errorNo ?? topResult?.errorNo;
    if (errorNo == null || errorNo === '') {
      return {};
    }
    return {
      smErrorNo: errorNo
    };
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
      } else if (err.errorCode === 'noStore') {
        CheckUtil.expectEqual(btns.length, 1);
        CheckUtil.expectEqual(btns[0].value, 'downloadExcelStore');
      } else if (err.errorCode === 'noUsers') {
        CheckUtil.expectEqual(btns.length, 1);
        CheckUtil.expectEqual(btns[0].value, 'downloadExcelUsers');
      } else {
        CheckUtil.expectEqual(btns.length, 1, `${err.errorCode} 应仅有一个按钮`);
        CheckUtil.expectEqual(btns[0].value, 'downloadExcelError');
      }
    }
  }

  private findMaterial(content: any[], name: string) {
    let material = content.find(row => row.name === name);
    CheckUtil.expectEqual(material != null, true, `未找到物料 ${name}`);
    return material;
  }

  private checkMaterialRow(material: any, opt: {
    name: string;
    category?: string;
    buyUnitNames: string[];
    buyUnitFees: number[];
  }) {
    if (opt.category != null) {
      CheckUtil.expectEqual(material.category?.name, opt.category, `${opt.name} 分类`);
    }
    let buyUnit: any[] = material.buyUnit ?? [];
    CheckUtil.expectEqual(
      buyUnit.length,
      opt.buyUnitNames.length,
      `${opt.name} 规格级数应为 ${opt.buyUnitNames.length}，实际 ${JSON.stringify(buyUnit)}`
    );
    for (let i = 0; i < opt.buyUnitNames.length; i++) {
      CheckUtil.expectEqual(buyUnit[i]?.name, opt.buyUnitNames[i], `${opt.name} 第${i}级单位`);
      CheckUtil.expectEqual(Number(buyUnit[i]?.fee), opt.buyUnitFees[i], `${opt.name} 第${i}级 fee`);
    }
  }

  private checkFruitMaterial(content: any[], name: string) {
    this.checkMaterialRow(this.findMaterial(content, name), {
      name,
      category: '水果',
      buyUnitNames: ['克', '斤'],
      buyUnitFees: [1, 500]
    });
  }

  private checkStoreRow(row: any, opt: {
    name: string;
    mobile: string;
    address: string;
  }) {
    CheckUtil.expectEqual(row != null, true, `应有门店 ${opt.name}`);
    CheckUtil.expectEqual(row.type, 'store', `${opt.name} type 应为 store`);
    CheckUtil.expectEqual(String(row.mobile ?? ''), opt.mobile, `${opt.name} 电话`);
    CheckUtil.expectEqual(String(row.address ?? ''), opt.address, `${opt.name} 地址`);
  }

  private checkCnt(actual: any, expected: { cnt: number; buyUnitFee: number } | null, label: string) {
    if (expected == null) {
      let cnt = actual?.cnt;
      CheckUtil.expectEqual(
        cnt == null || Number(cnt) === 0,
        true,
        `${label} 应为空，实际 cnt=${cnt}`
      );
      return;
    }
    CheckUtil.expectEqual(
      StockUtil.isEq(
        { cnt: Number(actual?.cnt), buyUnitFee: Number(actual?.buyUnitFee) },
        expected
      ),
      true,
      `${label} 应为 cnt=${expected.cnt} fee=${expected.buyUnitFee}，实际 cnt=${actual?.cnt} fee=${actual?.buyUnitFee}`
    );
  }

  private checkOrderPrice(row: any, opt: { name: string; price: number; buyUnitFee: number }) {
    CheckUtil.expectEqual(
      StockUtil.isEqPrice(
        { price: row?.supplierMaterial?.price, buyUnitFee: row?.supplierMaterial?.buyUnitFee },
        { price: opt.price, buyUnitFee: opt.buyUnitFee }
      ),
      true,
      `${opt.name} 价格应为 ${opt.price}(fee=${opt.buyUnitFee})，实际 price=${row?.supplierMaterial?.price} fee=${row?.supplierMaterial?.buyUnitFee}`
    );
  }

  private checkSmPrice(row: any, opt: {
    name: string;
    price: number;
    buyUnitFee: number;
  }) {
    CheckUtil.expectEqual(row != null, true, `应有供应关系 ${opt.name}`);
    CheckUtil.expectEqual(
      StockUtil.isEqPrice(
        { price: row.price, buyUnitFee: row.buyUnitFee },
        { price: opt.price, buyUnitFee: opt.buyUnitFee }
      ),
      true,
      `${opt.name} 价格应为 ${opt.price}(fee=${opt.buyUnitFee})，实际 price=${row?.price} fee=${row?.buyUnitFee}`
    );
  }

  protected buildActions(): BaseTest[] {
    return [
      new FindLastUserId().setRemark('查找最大测试用户'),
      new GetOpenId().setRemark('注册测试用户'),
      new AddWarehouse({
        name: '供应商仓',
        type: 'supplier'
      }).setRemark('新建供应商仓库'),
      new ChangeWarehouse().setRemark('切换到供应商仓库'),
      new SaveLogin('mainToken', 'mainUsersId'),
      new Action({
        name: '设置主用户昵称',
        remark: '主用户 name/nickName=测试操作人（getNickName 优先 name）',
        url: '/free/update',
        param: {
          table: 'users',
          cdts: [
            { col: 'usersId', val: '${mainUsersId}' }
          ],
          data: {
            nickName: '测试操作人',
            name: '测试操作人'
          }
        }
      }),
      new AddWarehouseUsers({
        warehouseKey: 'warehouse',
        remark: '新增阿大、阿二，共3个操作用户',
        users: [
          { key: 'ada', nickName: '阿大' },
          { key: 'aer', nickName: '阿二' }
        ]
      }),
      new UseLogin('mainToken', 'mainUsersId'),

      new Action({
        name: '新增物料[荔枝]',
        remark: '荔枝（包）',
        url: '/app/material/SaveMaterial',
        method: 'POST',
        param: {
          name: '荔枝',
          remark: '',
          img: [],
          buyUnit: [
            { isSupplier: true, name: '包', fee: 1 }
          ],
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        buildVariable(result) {
          return {
            lizhiMaterialId: result.result.materialId
          };
        },
        check(result) {
          CheckUtil.expectEqual(result.result?.materialId != null, true, 'SaveMaterial 应返回 materialId');
        }
      }),

      new Action({
        name: '更改物料规格[荔枝1包=500g]',
        remark: 'saveBuyUnit：克+包，1包=500克',
        url: '/app/material/saveBuyUnit',
        param: {
          materialId: '${lizhiMaterialId}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          buyUnit: [
            { name: '克', fee: 1 },
            { name: '包', fee: 500, isSupplier: true }
          ],
          supplierUnitsName: '包'
        }
      }),

      new Action({
        name: '校验荔枝规格',
        url: '/app/material/listMaterial4Supplier',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          this.checkMaterialRow(this.findMaterial(content, '荔枝'), {
            name: '荔枝',
            buyUnitNames: ['克', '包'],
            buyUnitFees: [1, 500]
          });
        }
      }),

      ...this.buildUploadAndSave(
        '上传物料[失败]',
        'material4Supplier',
        '上传物料失败',
        (importResult) => this.checkFailImport(importResult)
      ),

      new Action({
        name: '校验失败上传后的物料',
        remark: '苹果单位含逗号失败未入库；葡萄成功入库',
        url: '/app/material/listMaterial4Supplier',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          let names = content.map(row => row.name);
          CheckUtil.expectEqual(names.includes('苹果'), false, '苹果应失败未入库');
          CheckUtil.expectEqual(names.includes('葡萄'), true, '葡萄应成功入库');
          this.checkFruitMaterial(content, '葡萄');
        }
      }),

      ...this.buildUploadAndSave(
        '上传物料[成功]',
        'material4Supplier',
        '上传物料成功',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '成功上传 checked 应为 true');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg, '一共上传了5条物料。');
        }
      ),

      new Action({
        name: '校验成功上传后的物料',
        remark: '苹果/葡萄/香蕉/桃子/西瓜入库，校验分类和规格',
        url: '/app/material/listMaterial4Supplier',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          this.checkFruitMaterial(content, '苹果');
          this.checkFruitMaterial(content, '葡萄');
          this.checkFruitMaterial(content, '香蕉');
          this.checkFruitMaterial(content, '桃子');
          this.checkFruitMaterial(content, '西瓜');
          this.checkMaterialRow(this.findMaterial(content, '荔枝'), {
            name: '荔枝',
            buyUnitNames: ['克', '包'],
            buyUnitFees: [1, 500]
          });
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          let materialStockUnits: any = {};
          let materialIds: any = {};
          for (let row of content) {
            materialStockUnits[row.name] = row.stockUnitsId;
            materialIds[row.name] = row.materialId;
          }
          return { materialStockUnits, materialIds };
        }
      }),

      new CheckArray([{
        table: 'material',
        notWarhouseId: true,
        check(array) {
          let codeByName: any = {
            苹果: 'pingguo',
            葡萄: 'putao',
            香蕉: 'xiangjiao',
            桃子: 'taozi',
            西瓜: 'xigua'
          };
          for (let name in codeByName) {
            let row = array.find((item: any) => item.name === name);
            CheckUtil.expectEqual(row != null, true, `material 表应有${name}`);
            CheckUtil.expectEqual(row.code, codeByName[name], `${name}物料编码`);
          }
        }
      }]).setRemark('校验物料编码'),

      ...this.buildUploadAndSave(
        '上传门店[失败]',
        'store',
        '上传门店失败',
        (importResult) => this.checkFailImport(importResult)
      ),

      new Action({
        name: '校验失败上传后的门店',
        remark: '餐厅名称为空失败未入库；面包店成功入库',
        url: '/app/supplier/listSupplier',
        param: {
          type: 'store',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          let names = content.map(row => row.name);
          CheckUtil.expectEqual(names.includes('海鲜店'), false, '海鲜店尚未上传');
          CheckUtil.expectEqual(content.length, 1, '名称为空失败后应只入库1家餐厅');
          this.checkStoreRow(content.find(row => row.name === '面包店'), {
            name: '面包店',
            mobile: '77777777',
            address: '文一路2号'
          });
        }
      }),

      ...this.buildUploadAndSave(
        '上传门店[成功]',
        'store',
        '上传门店成功',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '门店上传成功 checked 应为 true');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg, '共导入了2家餐厅');
        }
      ),

      new Action({
        name: '校验成功上传后的门店',
        remark: 'listSupplier type=store：海鲜店、面包店',
        url: '/app/supplier/listSupplier',
        param: {
          type: 'store',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 2, '应导入2家餐厅');
          this.checkStoreRow(content.find(row => row.name === '海鲜店'), {
            name: '海鲜店',
            mobile: '88888888',
            address: '文一路1号'
          });
          this.checkStoreRow(content.find(row => row.name === '面包店'), {
            name: '面包店',
            mobile: '77777777',
            address: '文一路2号'
          });
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          return {
            storeMap: ArrayUtil.toMapByKey(content, 'name', 'supplierId')
          };
        }
      }),

      ...this.buildUploadAndSave(
        '上传供应关系[失败]',
        'supplierMaterial4supplier',
        '上传供应关系失败',
        (importResult) => this.checkFailImport(importResult),
        (importResult, topResult) => this.collectSmErrorVar(importResult, topResult)
      ),

      new Action({
        name: '查询供应关系失败信息',
        remark: '按 errorNo 查 excelError，核对该次失败的三类错误',
        url: '/free/query',
        param: {
          array: [{
            table: 'excelError',
            query: {
              errorNo: '${smErrorNo}',
              isDel: 0
            }
          }]
        }
      }, {
        check(result) {
          let array: any[] = result.result?.excelError ?? [];
          CheckUtil.expectEqual(array.length > 0, true, 'excelError 应有失败记录');
          let msgs = array.map((row: any) => String(row.errorMsg ?? '')).join('\n');
          CheckUtil.expectEqual(
            msgs.includes('包') || msgs.includes('单位'),
            true,
            `应有物料单位失败，实际=${msgs}`
          );
          CheckUtil.expectEqual(
            msgs.includes('没有价格'),
            true,
            `应有价格为空失败，实际=${msgs}`
          );
          CheckUtil.expectEqual(
            msgs.includes('餐厅不存在') || array.some((row: any) => row.errorCode === 'noStore'),
            true,
            `应有门店不存在失败，实际=${msgs}`
          );
        }
      }),

      ...this.buildUploadAndSave(
        '上传供应关系[成功]',
        'supplierMaterial4supplier',
        '上传供应关系成功',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '供应关系上传成功 checked 应为 true');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg, '共导入5条供应关系');
        }
      ),

      new Action({
        name: '校验海鲜店供应关系',
        remark: '苹果 10元/公斤（标准单位克，fee=-1000）；荔枝 100元/公斤（标准单位包，1公斤=2包，fee=-2）',
        url: '/app/supplierMaterial/listSupplierMaterial4Supplier',
        param: {
          supplierId: '${storeMap.海鲜店}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          this.checkSmPrice(content.find(row => row.name === '苹果'), {
            name: '海鲜店-苹果',
            price: 10,
            buyUnitFee: -1000
          });
          this.checkSmPrice(content.find(row => row.name === '荔枝'), {
            name: '海鲜店-荔枝',
            price: 100,
            buyUnitFee: -2
          });
        }
      }),

      new Action({
        name: '校验面包店供应关系',
        remark: '葡萄11/斤、桃子12/斤、香蕉12/斤（标准单位克，1斤=500克，fee=-500）；xiangjiao 按编码匹配到香蕉',
        url: '/app/supplierMaterial/listSupplierMaterial4Supplier',
        param: {
          supplierId: '${storeMap.面包店}',
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          this.checkSmPrice(content.find(row => row.name === '葡萄'), {
            name: '面包店-葡萄',
            price: 11,
            buyUnitFee: -500
          });
          this.checkSmPrice(content.find(row => row.name === '桃子'), {
            name: '面包店-桃子',
            price: 12,
            buyUnitFee: -500
          });
          this.checkSmPrice(content.find(row => row.name === '香蕉'), {
            name: '面包店-香蕉',
            price: 12,
            buyUnitFee: -500
          });
          CheckUtil.expectEqual(
            content.some(row => row.name === 'xiangjiao'),
            false,
            '物料编码匹配后名称应为香蕉，不应出现 xiangjiao'
          );
        }
      }),

      ...this.buildUploadAndSave(
        '上传订单[失败]',
        'noteOutStocked',
        '上传订单失败',
        (importResult) => {
          this.checkFailImport(importResult);
          let errors: any[] = importResult?.errors ?? [];
          let codes = errors.map(row => row.errorCode);
          CheckUtil.expectEqual(codes.includes('noMaterial'), true, '应有物料不存在');
          CheckUtil.expectEqual(codes.includes('noStore'), true, '应有餐厅不存在');
        },
        undefined,
        { status: 'outstocked' }
      ),

      new Action({
        name: '校验失败上传后没有订单',
        remark: '缺订货数量、餐厅不存在、物料不存在时整批不入库',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check(result) {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 0, '失败上传不应产生订单');
        }
      }),

      new Action({
        name: '发货前盘点',
        remark: `昨天盘点：后续发货数量再多 ${INIT_EXTRA}。盘点在当天 23:59，必须早于发货`,
        url: '/app/inventory/setInventoryByArray',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        parseHttpParam: (param, variable) => {
          let ids = variable.materialIds ?? {};
          let rows = [
            { name: '苹果', send: 3, buyUnitFee: -500 },
            { name: '葡萄', send: 2, buyUnitFee: -500 },
            { name: '桃子', send: 5, buyUnitFee: -500 },
            { name: '荔枝', send: 1, buyUnitFee: 1 },
            { name: '香蕉', send: 5, buyUnitFee: -500 }
          ];
          let uploadInitStock: any = {};
          let array = rows.map(row => {
            let cnt = row.send + INIT_EXTRA;
            uploadInitStock[row.name] = { cnt, buyUnitFee: row.buyUnitFee };
            return {
              materialId: ids[row.name],
              cnt,
              buyUnitFee: row.buyUnitFee,
              cost: 0
            };
          });
          variable.uploadInitStock = uploadInitStock;
          return {
            warehouseId: param.warehouseId,
            warehouseGroupId: param.warehouseGroupId,
            bussinessDate: inventoryDay(),
            array
          };
        }
      }),

      ...this.buildUploadAndSave(
        '上传订单[出库]',
        'noteOutStocked',
        '上传订单成功',
        (importResult, topResult) => {
          if (importResult?.checked !== true) {
            let errors: any[] = importResult?.errors ?? [];
            let detail = errors.map(e => `${e.errorCode}:${e.errorMsg ?? e.msg ?? ''}`).join('; ');
            CheckUtil.expectEqual(importResult?.checked, true, `订单上传成功 checked 应为 true，errors=[${detail}]`);
          }
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg, '一共上传了5条物料，共3个订单，金额为444。');
        },
        undefined,
        { status: 'outstocked' }
      ),

      new Action({
        name: '校验出库订单',
        remark: '同一天同一餐厅合并；状态 outstocked',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 3, '应产生3个订单');
          let seafoodDay1 = content.find(row =>
            row.supplierName === '海鲜店' && String(row.createTime ?? '').indexOf('2026-09-01') >= 0
          );
          let bread = content.find(row => row.supplierName === '面包店');
          let seafoodDay2 = content.find(row =>
            row.supplierName === '海鲜店' && String(row.createTime ?? '').indexOf('2026-09-02') >= 0
          );
          this.checkUploadedNote(seafoodDay1, { name: '9/1海鲜店', materialCnt: 2, cost: 64, pickCost: 64, outstockCost: 74 });
          this.checkUploadedNote(bread, { name: '9/1面包店', materialCnt: 1, cost: 60, pickCost: 12, outstockCost: 24 });
          this.checkUploadedNote(seafoodDay2, { name: '9/2海鲜店', materialCnt: 2, cost: 320, pickCost: 320, outstockCost: 320 });
          this.checkNoteOpTime(seafoodDay1, {
            name: '9/1海鲜店',
            acceptDay: '2026-08-28',
            pickDay: '2026-08-29',
            sendDay: '2026-08-30',
            outstockDay: '2026-08-31'
          });
          this.checkNoteOpTime(bread, {
            name: '9/1面包店',
            acceptDay: '2026-08-28',
            pickDay: '2026-08-29',
            sendDay: '2026-08-30',
            outstockDay: '2026-08-31'
          });
          this.checkNoteOpTime(seafoodDay2, {
            name: '9/2海鲜店',
            acceptDay: '2026-09-01',
            pickDay: '2026-09-01',
            sendDay: '2026-09-02',
            outstockDay: '2026-09-02'
          });
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          return {
            noteIds: ArrayUtil.toArray(content, 'noteId')
          };
        }
      }),

      new Action({
        name: '校验出库订单物料',
        remark: '数量规则、结算清空、公斤回落到库存单位、操作人与时间',
        url: '/app/noteItem/listNoteItem',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          noteId: '${noteIds}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 5, '应有5条订单物料');
          let jinFee = -500;
          let matchSend = (row, cnt) => StockUtil.isEq(
            { cnt: Number(row.sendCnt?.cnt), buyUnitFee: Number(row.sendCnt?.buyUnitFee) },
            { cnt, buyUnitFee: jinFee }
          );
          let apple1 = content.find(row => row.name === '苹果' && matchSend(row, 1));
          let apple2 = content.find(row => row.name === '苹果' && matchSend(row, 2));
          let grape = content.find(row => row.name === '葡萄');
          let peach = content.find(row => row.name === '桃子');
          let lizhi = content.find(row => row.name === '荔枝');
          this.checkOutstockItem(apple1, {
            name: '苹果-斤', price: 10, fee: jinFee,
            orderCnt: 2, pickCnt: 2, sendCnt: 1, outCnt: 3
          });
          this.checkOutstockItem(grape, {
            name: '葡萄', price: 11, fee: jinFee,
            orderCnt: 4, pickCnt: 4, sendCnt: 2, outCnt: 4
          });
          this.checkOutstockItem(peach, {
            name: '桃子', price: 12, fee: jinFee,
            orderCnt: 5, pickCnt: 1, sendCnt: 5, outCnt: 2
          });
          this.checkOutstockItem(lizhi, {
            name: '荔枝', price: 100, fee: 1,
            orderCnt: 3, pickCnt: 3, sendCnt: 1, outCnt: 3
          });
          this.checkOutstockItem(apple2, {
            name: '苹果-公斤回落斤', price: 10, fee: jinFee,
            orderCnt: 2, pickCnt: 2, sendCnt: 2, outCnt: 2
          });
          let stockUnits = this.getVariable().materialStockUnits ?? {};
          CheckUtil.expectEqual(apple1?.stockUnitsId, stockUnits['苹果'], '斤应写入苹果库存单位');
          CheckUtil.expectEqual(apple2?.stockUnitsId, stockUnits['苹果'], '公斤不在规格中应回落到苹果库存单位');
          CheckUtil.expectEqual(lizhi?.stockUnitsId, stockUnits['荔枝'], '包应写入荔枝库存单位');
          let v = this.getVariable();
          for (let row of [apple1, grape, peach]) {
            this.checkSupplierUploadOp(row, {
              name: row?.name,
              createUser: row?.name === '桃子' ? '李四' : '张三',
              acceptUsersId: v.adaUsersId,
              pickUsersId: v.aerUsersId,
              sendUsersId: v.mainUsersId,
              outstockUsersId: v.adaUsersId,
              acceptDay: '2026-08-28',
              pickDay: '2026-08-29',
              sendDay: '2026-08-30',
              outstockDay: '2026-08-31'
            });
          }
          for (let row of [lizhi, apple2]) {
            this.checkSupplierUploadOp(row, {
              name: row?.name,
              createUser: '张三',
              acceptUsersId: v.adaUsersId,
              pickUsersId: v.aerUsersId,
              sendUsersId: v.mainUsersId,
              outstockUsersId: v.adaUsersId,
              acceptDay: '2026-09-01',
              pickDay: '2026-09-01',
              sendDay: '2026-09-02',
              outstockDay: '2026-09-02'
            });
          }
        }
      }),

      new Action({
        name: '校验出库扣库存',
        remark: '库存 = 昨天盘点 − 发货数量：苹果3斤、葡萄2斤、桃子5斤、荔枝1包',
        url: '/free/query',
        param: {
          array: [{
            table: 'stock',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        check: (result) => {
          let stocks: any[] = result.result?.stock ?? [];
          let ids = this.getVariable().materialIds ?? {};
          this.checkStockRow(stocks, ids['苹果'], this.stockAfterSend('苹果', 3, -500));
          this.checkStockRow(stocks, ids['葡萄'], this.stockAfterSend('葡萄', 2, -500));
          this.checkStockRow(stocks, ids['桃子'], this.stockAfterSend('桃子', 5, -500));
          this.checkStockRow(stocks, ids['荔枝'], this.stockAfterSend('荔枝', 1, 1));
        }
      }),

      ...this.buildUploadAndSave(
        '上传订单[待发货]',
        'noteOutStocked',
        '上传订单待发货',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '待发货上传 checked 应为 true');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg, '一共上传了1条物料，共1个订单，金额为60。');
        },
        undefined,
        { status: 'picked' }
      ),

      new Action({
        name: '校验待发货订单物料',
        remark: '只保留拣货数量，发货/入库/结算清空',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          status: 'picked'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, '应有1张待发货订单');
          CheckUtil.expectEqual(content[0]?.status, 'picked', '状态应为 picked');
          CheckUtil.expectEqual(content[0]?.cost, 60, '订货金额应为60');
          this.checkNoteOpTime(content[0], {
            name: '待发货',
            acceptDay: '2026-09-02',
            pickDay: '2026-09-03'
          });
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          return {
            pickedNoteId: content[0]?.noteId
          };
        }
      }),

      new Action({
        name: '校验待发货数量',
        url: '/app/noteItem/listNoteItem',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          noteId: '${pickedNoteId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, '待发货订单应有1条物料');
          let row = content[0];
          CheckUtil.expectEqual(row?.name, '西瓜', '物料应为西瓜');
          this.checkOrderPrice(row, { name: '西瓜', price: 10, buyUnitFee: -500 });
          this.checkCnt(row?.purcharse, { cnt: 6, buyUnitFee: -500 }, '西瓜订货');
          this.checkCnt(row?.pick, { cnt: 2, buyUnitFee: -500 }, '西瓜拣货');
          this.checkCnt(row?.sendCnt, null, '西瓜发货');
          this.checkCnt(row?.outstock, null, '西瓜入库');
          this.checkCnt(row?.statementCnt, null, '西瓜结算');
        }
      }),

      new Action({
        name: '校验待发货不扣库存',
        remark: '西瓜不应产生库存；苹果仍是盘点减去已发货的 3 斤',
        url: '/free/query',
        param: {
          array: [{
            table: 'stock',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        check: (result) => {
          let stocks: any[] = result.result?.stock ?? [];
          let ids = this.getVariable().materialIds ?? {};
          let melon = stocks.find(row => String(row.materialId) === String(ids['西瓜']));
          CheckUtil.expectEqual(melon == null || Number(melon.cnt) === 0, true, '待发货不应扣西瓜库存');
          this.checkStockRow(stocks, ids['苹果'], this.stockAfterSend('苹果', 3, -500));
        }
      }),

      ...this.buildUploadAndSave(
        '上传订单[发货]',
        'noteOutStocked',
        '上传订单发货',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '发货上传 checked 应为 true');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg, '一共上传了1条物料，共1个订单，金额为48。');
        },
        undefined,
        { status: 'sended' }
      ),

      new Action({
        name: '校验发货订单',
        remark: '状态 sended，拣货金额按默认拣货数量',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          status: 'sended'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, '应有1张发货订单');
          let note = content[0];
          CheckUtil.expectEqual(note?.status, 'sended', '状态应为 sended');
          CheckUtil.expectEqual(note?.type, 'send', '类型应为发货单');
          CheckUtil.expectEqual(note?.origin, 'upload', '来源应为上传');
          CheckUtil.expectEqual(Number(note?.cost), 48, '订货金额应为48');
          CheckUtil.expectEqual(Number(note?.pickCost), 48, '拣货金额应按默认拣货数量 4斤');
          CheckUtil.expectEqual(
            note?.outstockCost == null || Number(note.outstockCost) === 0,
            true,
            '发货状态不应写出库金额'
          );
          CheckUtil.expectEqual(
            note?.statementCost == null || Number(note.statementCost) === 0,
            true,
            '发货状态不应写结算金额'
          );
          this.checkNoteOpTime(note, {
            name: '发货',
            acceptDay: '2026-09-03',
            pickDay: '2026-09-04',
            sendDay: '2026-09-04'
          });
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          return {
            sendedNoteId: content[0]?.noteId
          };
        }
      }),

      new Action({
        name: '校验发货数量',
        remark: '拣货、发货默认订货数量；Excel 里的入库、结算不写入',
        url: '/app/noteItem/listNoteItem',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          noteId: '${sendedNoteId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, '发货订单应有1条物料');
          let row = content[0];
          let fee = -500;
          CheckUtil.expectEqual(row?.name, '香蕉', '物料应为香蕉');
          this.checkOrderPrice(row, { name: '香蕉', price: 12, buyUnitFee: fee });
          this.checkCnt(row?.purcharse, { cnt: 4, buyUnitFee: fee }, '香蕉订货');
          this.checkCnt(row?.pick, { cnt: 4, buyUnitFee: fee }, '香蕉拣货默认订货数量');
          this.checkCnt(row?.sendCnt, { cnt: 4, buyUnitFee: fee }, '香蕉发货默认订货数量');
          this.checkCnt(row?.outstock, null, '香蕉入库不应写入');
          this.checkCnt(row?.statementCnt, null, '香蕉结算不应写入');
          this.checkCnt(row?.instock, null, '香蕉门店入库数量不应写入');
          let v = this.getVariable();
          CheckUtil.expectEqual(row?.userOfPicker?.name, '阿二', '香蕉拣货人');
          CheckUtil.expectEqual(Number(row?.pickUser), Number(v.aerUsersId), '香蕉 pickUser=阿二');
          CheckUtil.expectEqual(Number(row?.sendUser), Number(v.mainUsersId), '香蕉 sendUser=测试操作人');
          CheckUtil.expectEqual(Number(row?.acceptUser), Number(v.adaUsersId), '香蕉 acceptUser=阿大');
          CheckUtil.expectEqual(this.dayOf(row?.pickTime), '2026-09-04', '香蕉 pickTime');
          CheckUtil.expectEqual(this.dayOf(row?.sendTime), '2026-09-04', '香蕉 sendTime');
          CheckUtil.expectEqual(row?.createUser, '王五', '香蕉订货人');
        }
      }),

      new Action({
        name: '校验发货扣库存',
        remark: '香蕉按默认发货 4 斤从盘点库存扣减，苹果仍是已扣的 3 斤',
        url: '/free/query',
        param: {
          array: [{
            table: 'stock',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        check: (result) => {
          let stocks: any[] = result.result?.stock ?? [];
          let ids = this.getVariable().materialIds ?? {};
          this.checkStockRow(stocks, ids['香蕉'], this.stockAfterSend('香蕉', 4, -500));
          this.checkStockRow(stocks, ids['苹果'], this.stockAfterSend('苹果', 3, -500));
        }
      }),

      ...this.buildUploadAndSave(
        '上传订单[结算]',
        'noteOutStocked',
        '上传订单结算',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '结算上传 checked 应为 true');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg, '一共上传了1条物料，共1个订单，金额为36。');
        },
        undefined,
        { status: 'statement' }
      ),

      new Action({
        name: '校验结算订单',
        remark: '状态 statement，拣货/出库/结算金额按默认数量',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          status: 'statement'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, '应有1张结算订单');
          let note = content[0];
          CheckUtil.expectEqual(note?.status, 'statement', '状态应为 statement');
          CheckUtil.expectEqual(Number(note?.cost), 36, '订货金额应为36');
          CheckUtil.expectEqual(Number(note?.pickCost), 36, '拣货金额应按默认拣货数量 3斤');
          CheckUtil.expectEqual(Number(note?.outstockCost), 36, '出库金额应按默认入库数量 3斤');
          CheckUtil.expectEqual(Number(note?.statementCost), 36, '结算金额应按默认结算数量 3斤');
          this.checkNoteOpTime(note, {
            name: '结算',
            acceptDay: '2026-09-04',
            pickDay: '2026-09-05',
            sendDay: '2026-09-05',
            outstockDay: '2026-09-05',
            statementDay: '2026-09-05'
          });
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          return {
            statementNoteId: content[0]?.noteId
          };
        }
      }),

      new Action({
        name: '校验结算数量',
        remark: '拣货、入库、结算默认订货数量；发货用 Excel 的 1 斤；不写 instockCnt',
        url: '/app/noteItem/listNoteItem',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          noteId: '${statementNoteId}'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          CheckUtil.expectEqual(content.length, 1, '结算订单应有1条物料');
          let row = content[0];
          let fee = -500;
          CheckUtil.expectEqual(row?.name, '香蕉', '物料应为香蕉');
          this.checkOrderPrice(row, { name: '香蕉结算', price: 12, buyUnitFee: fee });
          this.checkCnt(row?.purcharse, { cnt: 3, buyUnitFee: fee }, '香蕉订货');
          this.checkCnt(row?.pick, { cnt: 3, buyUnitFee: fee }, '香蕉拣货默认订货数量');
          this.checkCnt(row?.sendCnt, { cnt: 1, buyUnitFee: fee }, '香蕉发货');
          this.checkCnt(row?.outstock, { cnt: 3, buyUnitFee: fee }, '香蕉入库默认订货数量');
          this.checkCnt(row?.statementCnt, { cnt: 3, buyUnitFee: fee }, '香蕉结算默认订货数量');
          this.checkCnt(row?.instock, null, '香蕉门店入库数量不应写入');
        }
      }),

      new Action({
        name: '校验结算扣库存',
        remark: '结算再按发货 1 斤扣香蕉，合计扣 5 斤',
        url: '/free/query',
        param: {
          array: [{
            table: 'stock',
            query: {
              warehouseId: '${warehouse.warehouseId}',
              warehouseGroupId: '${warehouse.warehouseGroupId}',
              isDel: 0
            }
          }]
        }
      }, {
        check: (result) => {
          let stocks: any[] = result.result?.stock ?? [];
          let ids = this.getVariable().materialIds ?? {};
          this.checkStockRow(stocks, ids['香蕉'], this.stockAfterSend('香蕉', 5, -500));
        }
      }),

      ...this.buildUploadAndSave(
        '上传订单[重复物料]',
        'noteOutStocked',
        '上传订单_重复物料合并',
        (importResult, topResult) => {
          CheckUtil.expectEqual(importResult?.checked, true, '重复物料上传 checked 应为 true');
          let succMsg = topResult?.succMsg ?? importResult?.succMsg;
          CheckUtil.expectEqual(succMsg, '一共上传了1条物料，共1个订单，金额为78。');
        },
        undefined,
        { status: 'outstocked' }
      ),

      new Action({
        name: '校验重复物料合并后的订单',
        remark: '同单同物料合并为1条；金额78',
        url: '/app/note/listNote',
        param: {
          warehouseId: '${warehouse.warehouseId}',
          warehouseGroupId: '${warehouse.warehouseGroupId}',
          status: 'outstocked'
        }
      }, {
        check: (result) => {
          let content: any[] = result.result?.content ?? [];
          let note = content.find(row =>
            row.supplierName === '面包店' && String(row.createTime ?? '').indexOf('2026-09-10') >= 0
          );
          CheckUtil.expectEqual(note != null, true, '应有9/10面包店重复物料订单');
          CheckUtil.expectEqual(note?.materialCnt, 1, '合并后应为1条物料');
          CheckUtil.expectEqual(Number(note?.cost), 78, '合并后订货金额应为78');
          this.checkNoteOpTime(note, {
            name: '重复物料',
            acceptDay: '2026-09-07',
            pickDay: '2026-09-08',
            sendDay: '2026-09-09',
            outstockDay: '2026-09-10'
          });
        },
        buildVariable(result) {
          let content: any[] = result.result?.content ?? [];
          let note = content.find(row =>
            row.supplierName === '面包店' && String(row.createTime ?? '').indexOf('2026-09-10') >= 0
          );
          return {
            dupNoteId: note?.noteId
          };
        }
      }),

      new Action({
        name: '校验重复物料合并明细与操作人时间',
        remark: '数量累加、金额倒算价；操作人/时间取第一行',
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
          let row = content[0];
          let fee = -500;
          CheckUtil.expectEqual(row?.name, '香蕉', '物料应为香蕉');
          this.checkOrderPrice(row, { name: '香蕉合并', price: 15.6, buyUnitFee: fee });
          this.checkCnt(row?.purcharse, { cnt: 5, buyUnitFee: fee }, '香蕉合并订货');
          this.checkCnt(row?.pick, { cnt: 3, buyUnitFee: fee }, '香蕉合并拣货');
          this.checkCnt(row?.sendCnt, { cnt: 3, buyUnitFee: fee }, '香蕉合并发货');
          this.checkCnt(row?.outstock, { cnt: 3, buyUnitFee: fee }, '香蕉合并出库');
          let v = this.getVariable();
          this.checkSupplierUploadOp(row, {
            name: '香蕉合并',
            createUser: '合并订货人',
            acceptUsersId: v.adaUsersId,
            pickUsersId: v.aerUsersId,
            sendUsersId: v.mainUsersId,
            outstockUsersId: v.adaUsersId,
            acceptDay: '2026-09-07',
            pickDay: '2026-09-08',
            sendDay: '2026-09-09',
            outstockDay: '2026-09-10'
          });
        }
      }),

      new Action({
        name: '阿二设为管理员',
        remark: '将最后新增的用户阿二 usersWarehouse.isAdmin=1',
        url: '/free/update',
        param: {
          table: 'usersWarehouse',
          cdts: [
            { col: 'usersId', val: '${aerUsersId}' },
            { col: 'warehouseId', val: '${warehouse.warehouseId}' }
          ],
          data: { isAdmin: 1 }
        }
      }),
    ];
  }

  /**
   * 供应商上传订单的操作时间。传入的日期必须相等；没传的列应为空。
   */
  private checkNoteOpTime(note: any, opt: {
    name: string;
    acceptDay?: string;
    pickDay?: string;
    sendDay?: string;
    outstockDay?: string;
    statementDay?: string;
    instockDay?: string;
  }) {
    let cols: [string, string][] = [
      ['acceptTime', opt.acceptDay],
      ['pickTime', opt.pickDay],
      ['sendTime', opt.sendDay],
      ['outstockTime', opt.outstockDay],
      ['statementTime', opt.statementDay],
      ['instockTime', opt.instockDay]
    ];
    for (let [col, day] of cols) {
      if (day == null || day === '') {
        CheckUtil.expectEqual(
          note?.[col] == null || note?.[col] === '',
          true,
          `${opt.name} 订单 ${col} 应为空，实际=${note?.[col]}`
        );
      } else {
        CheckUtil.expectEqual(
          this.dayOf(note?.[col]),
          day,
          `${opt.name} 订单 ${col} 应为 ${day}，实际=${note?.[col]}`
        );
      }
    }
  }

  private dayOf(value: any): string {
    if (value == null) {
      return '';
    }
    return String(value).substring(0, 10);
  }

  private checkSupplierUploadOp(row: any, opt: {
    name: string;
    createUser: string;
    acceptUsersId: any;
    pickUsersId: any;
    sendUsersId: any;
    outstockUsersId: any;
    acceptDay: string;
    pickDay: string;
    sendDay: string;
    outstockDay: string;
  }) {
    CheckUtil.expectEqual(row != null, true, `${opt.name} 应有明细`);
    CheckUtil.expectEqual(row?.createUser, opt.createUser, `${opt.name} createUser`);
    CheckUtil.expectEqual(Number(row?.acceptUser), Number(opt.acceptUsersId), `${opt.name} acceptUser=阿大`);
    CheckUtil.expectEqual(Number(row?.pickUser), Number(opt.pickUsersId), `${opt.name} pickUser=阿二`);
    CheckUtil.expectEqual(Number(row?.sendUser), Number(opt.sendUsersId), `${opt.name} sendUser=测试操作人`);
    CheckUtil.expectEqual(Number(row?.outstockUser), Number(opt.outstockUsersId), `${opt.name} outstockUser=阿大`);
    CheckUtil.expectEqual(this.dayOf(row?.acceptTime), opt.acceptDay, `${opt.name} acceptTime`);
    CheckUtil.expectEqual(this.dayOf(row?.pickTime), opt.pickDay, `${opt.name} pickTime`);
    CheckUtil.expectEqual(this.dayOf(row?.sendTime), opt.sendDay, `${opt.name} sendTime`);
    CheckUtil.expectEqual(this.dayOf(row?.outStockTime), opt.outstockDay, `${opt.name} outStockTime`);
    CheckUtil.expectEqual(row?.userOfPicker?.name, '阿二', `${opt.name} userOfPicker`);
  }

  private checkUploadedNote(note: any, opt: {
    name: string;
    materialCnt: number;
    cost: number;
    pickCost: number;
    outstockCost: number;
  }) {
    CheckUtil.expectEqual(note != null, true, `应有订单 ${opt.name}`);
    CheckUtil.expectEqual(note?.type, 'send', `${opt.name} 类型应为发货单`);
    CheckUtil.expectEqual(note?.status, 'outstocked', `${opt.name} 状态应为 outstocked`);
    CheckUtil.expectEqual(note?.origin, 'upload', `${opt.name} 来源应为上传`);
    CheckUtil.expectEqual(note?.materialCnt, opt.materialCnt, `${opt.name} 物料条数`);
    CheckUtil.expectEqual(Number(note?.cost), opt.cost, `${opt.name} 订货金额`);
    CheckUtil.expectEqual(Number(note?.pickCost), opt.pickCost, `${opt.name} 拣货金额`);
    CheckUtil.expectEqual(Number(note?.outstockCost), opt.outstockCost, `${opt.name} 出库金额`);
    CheckUtil.expectEqual(
      note?.statementCost == null || Number(note.statementCost) === 0,
      true,
      `${opt.name} 结算金额应为空`
    );
  }

  private checkOutstockItem(row: any, opt: {
    name: string;
    price: number;
    fee: number;
    orderCnt: number;
    pickCnt: number;
    sendCnt: number;
    outCnt: number;
  }) {
    CheckUtil.expectEqual(row != null, true, `应有物料 ${opt.name}`);
    let qty = { buyUnitFee: opt.fee };
    this.checkOrderPrice(row, { name: opt.name, price: opt.price, buyUnitFee: opt.fee });
    this.checkCnt(row?.purcharse, { ...qty, cnt: opt.orderCnt }, `${opt.name}订货`);
    this.checkCnt(row?.pick, { ...qty, cnt: opt.pickCnt }, `${opt.name}拣货`);
    this.checkCnt(row?.sendCnt, { ...qty, cnt: opt.sendCnt }, `${opt.name}发货`);
    this.checkCnt(row?.outstock, { ...qty, cnt: opt.outCnt }, `${opt.name}入库`);
    this.checkCnt(row?.statementCnt, null, `${opt.name}结算`);
  }

  /** 盘点初始数量减去已发货数量。同一 buyUnitFee 下直接相减。 */
  private stockAfterSend(name: string, sentCnt: number, buyUnitFee: number) {
    let init = this.getVariable().uploadInitStock?.[name];
    return {
      name,
      cnt: Number(init?.cnt) - sentCnt,
      buyUnitFee
    };
  }

  private checkStockRow(stocks: any[], materialId: any, opt: { name: string; cnt: number; buyUnitFee: number }) {
    let row = (stocks ?? []).find(item => String(item.materialId) === String(materialId));
    CheckUtil.expectEqual(row != null, true, `应有${opt.name}库存`);
    CheckUtil.expectEqual(
      StockUtil.isEq(
        { cnt: Number(row?.cnt), buyUnitFee: Number(row?.buyUnitFee) },
        { cnt: opt.cnt, buyUnitFee: opt.buyUnitFee }
      ),
      true,
      `${opt.name}库存应为 cnt=${opt.cnt} fee=${opt.buyUnitFee}，实际 cnt=${row?.cnt} fee=${row?.buyUnitFee}`
    );
  }
}

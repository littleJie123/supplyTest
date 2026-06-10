import { BaseTest, TestCase } from "testflow";
import Upload from "./Upload";
import UploadUtil from "../util/UploadUtil";
import Action from "./Action";
interface Opt {
  target?: string;
  fileName?: string
  check?(result: any)
  index?:number;
  name?:string;
  sheetName?:string;
}


export default class UploadCase extends TestCase {
  protected actionOpt: Opt;
  constructor(opt: Opt) {

    super();
    this.actionOpt = opt;
  }

  protected buildActions(): BaseTest[] {
    let opt = this.actionOpt;
    if(opt == null){
      opt = {}
    }
    let fileName = opt.fileName ?? '测试数据'
    let name = opt?.name ?? `${opt.target}:上传${fileName}`;

    let param:any = {
      target: opt.target ?? 'material',
      warehouseId: '${warehouse.warehouseId}',
      index:opt?.index ?? 0
    }
    if(opt?.sheetName){
      param.sheetName = opt.sheetName;
    }
    return [
      new Upload({
        name,
        param,
        filePath: UploadUtil.getFilePath(fileName)
      }, {
        check(result) {
          if (opt?.check) {
            opt.check(result)
          }
        },
        buildVariable(result) {
          let checkResult = result.result.importResult;
      
          result = result.result;
          let fileCols = result.fileCols;
          fileCols = fileCols.filter(row => row.targetCol != null);
          fileCols = fileCols.map(row => ({ targetCol: row.targetCol, excelFileId: row.excelFileId }))
          return {
            excelFileId: result.excelFileId,
            fileCols,
            uploadChecked: checkResult?.checked
          }
        }
      }),
      new Action({
        name: `saveExcel[${name}]`,
        url: '/app/excel/saveExcel',
        param: {
          excelFileId: '${excelFileId}',
          fileCols: '${fileCols}',
          warehouseId: '${warehouse.warehouseId}'
        }
      },{
        needRunVariable:{
          key:'uploadChecked',
          not:true
        }
      })
    ]
  }
  getName(): string {
    let name = this.actionOpt?.target ?? 'material';
    return `上传${name}`
  }

}
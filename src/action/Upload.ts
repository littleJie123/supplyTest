import { IUploadActionParam, UploadAction } from "testflow";
import IOpt from "../inf/IOpt";

export default class extends UploadAction {
  constructor(param: IUploadActionParam, afterProcess?: IOpt) {
    if(param.url==null  || param.url == ''){
      param.url = '/app/excel/uploadExcel';
    }
    if (param.param) {
      if (param.param.warehouseGroupId == null) {
        let warehouse = afterProcess?.warehouseType ?? 'warehouse';
        param.param.warehouseGroupId = `\${${warehouse}.warehouseGroupId}`
      }
    }
    super(param, afterProcess)
  }
}
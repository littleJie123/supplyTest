import path from "path";

export default class {
  /**
   * 返回excel的所在路径
   * @param strPath 
   * @returns 
   */
  static getFilePath(strPath: string) {
    if (!strPath.endsWith('.xlsx')) {
      strPath += '.xlsx'
    }
    let dir = path.join(__dirname, '../../excel/', strPath)
    return dir;

  }
}
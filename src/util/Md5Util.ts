import crypto from 'crypto';

export default class {
  /**
   * md5加密
   * @param str 
   */
  static md5(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  static buildPswd(pswd:string,userName?:string){
    return this.md5(`${userName}|${pswd}|supply`)
  }
}
import { BaseTest, UrlAction } from "fasttest";

export default class  extends UrlAction {
  
  protected getHttpUrl(): string {
    return '/free/findLastUser'
  }
   
  protected buildVariable(result: any) {
    let openid:string = result.result.openid
    let num = openid.substring('_test'.length);

    return {
      openid:`_test${parseInt(num) + 1}`,  
    }
  }
  
  getName():string{
    return '查找最大用户id';
  }
}
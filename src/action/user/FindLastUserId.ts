import { BaseTest, UrlAction } from "testflow";

export default class  extends UrlAction {
  
  protected getHttpUrl(): string {
    return '/free/findMaxTestUser'
  }
   
  protected buildVariable(result: any) {
    let openid:string = result.result.openid
    
    return {
      openid:`_test${openid + 1}`,  
    }
  }
  
  getName():string{
    return '查找最大用户id';
  }
}
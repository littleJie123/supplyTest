import { UrlAction } from "testflow";

export default class GetOpenId extends UrlAction{
  protected getMethod(): string {
    return 'GET';
  }
  protected getHttpUrl(): string {
    return '/free/getOpenId?code=${variable.openid}';
  }

  protected buildVariable(result: any) {

    return {
      warehouse:result.result.warehouse
    };
  }

  getName(): string {
    return '注册用户'
  }
}
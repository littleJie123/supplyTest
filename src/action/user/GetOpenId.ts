import { UrlAction } from "testflow";

export default class GetOpenId extends UrlAction{
  protected getMethod(): string {
    return 'GET';
  }
  protected getHttpUrl(): string {
    return '/free/getOpenId?code=${openid}';
  }

  protected buildVariable(result: any) {

    return {
      usersId:result.result.token.usersId,
      warehouse:result.result.warehouse,
      token:result.result.token.token
    };
  }

  getName(): string {
    return '注册用户'
  }
}
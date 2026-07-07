import { HttpAction } from "testflow";
import Md5Util from "../../util/Md5Util";

export default class LoginAdmin extends HttpAction {
  constructor(userName?: string, pswd?: string) {
    userName = userName ?? 'admin';
    pswd = pswd ?? 'lldadmin124';
    super({
      name: '管理员登录',
      url: '/free/loginAdmin',
      param: {
        userName,
        pswd: Md5Util.buildPswd(pswd,userName),
      }
    }, {
      buildVariable(result) {
        return {
          token:result.result.token,
        };
      }
    });
  }
}

import { BaseTest, HttpAction, TestCase } from "testflow";
import LoginAdmin from "../../action/adminUser/LoginAdmin";
import AdminQueryAction from "../../action/adminUser/AdminQueryAction";
import Md5Util from "../../util/Md5Util";

export default class extends TestCase {
  getName(): string {
    return '管理员增删改查';
  }

  protected buildActions(): BaseTest[] {
    const testAdminUserName = 'testAdmin_' + Date.now();
    let variable = this.getVariable();
    variable.token = '';
    return [
      new LoginAdmin(),
      new HttpAction({
        name: '新增管理员',
        url: '/admin/adminUser/addAdminUser',
        param: {
          userName: testAdminUserName,
          pswd: Md5Util.buildPswd('test123456', testAdminUserName),
          nickName: '测试管理员',
        }
      }, {
        buildVariable(result) {
          return {
            testAdminUserId: result.result.adminUserId,
          };
        },
        check(result) {
          result = result.result;
          if (result.userName !== testAdminUserName) {
            throw new Error('新增管理员返回 userName 不正确');
          }
          if (result.pwsd != null) {
            throw new Error('新增管理员不应返回密码');
          }
        }
      }),
      new AdminQueryAction({
        name: '查询新增的管理员',
        url: '/admin/adminUser/listAdminUser',
        query: {
          keyword: testAdminUserName,
        },
        len: 1,
        verify(content) {
          if (content[0].nickName !== '测试管理员') {
            throw new Error('新增管理员 nickName 不正确');
          }
        }
      }),
      new HttpAction({
        name: '更新管理员',
        url: '/admin/adminUser/updateAdminUser',
        param: {
          adminUserId: '${testAdminUserId}',
          nickName: '测试管理员2',
        }
      }),
      new AdminQueryAction({
        name: '查询更新后的管理员',
        url: '/admin/adminUser/listAdminUser',
        query: {
          keyword: testAdminUserName,
        },
        len: 1,
        verify(content) {
          if (content[0].nickName !== '测试管理员2') {
            throw new Error('更新管理员 nickName 不正确');
          }
        }
      }),
      new HttpAction({
        name: '删除管理员',
        url: '/admin/adminUser/delAdminUser',
        param: {
          adminUserId: '${testAdminUserId}',
        }
      }),
      new AdminQueryAction({
        name: '验证管理员已删除',
        url: '/admin/adminUser/listAdminUser',
        query: {
          keyword: testAdminUserName,
        },
        len: 0,
      }),
    ];
  }
}

import { HttpAction, IHttpActionParam } from "testflow";

export default class  extends HttpAction{
  protected getDefHttpParam(): IHttpActionParam {
    return {
      url:'/app/usersWarehouse/restoreUsersWarehouse',
      method:'post',
      name:'恢复用户',
      param:{
        usersId:130,
        //warehouseGroupId:0,
        data:{
          warehouseId:170,
          usersId:108
        }
      }
    }
  }
}
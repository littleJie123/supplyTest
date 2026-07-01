import { BaseTest, CheckUtil, TestCase } from "testflow";
import PreTest from "../PreTest";
import Action from "../../action/Action";

export default class extends TestCase{
  protected buildActions(): BaseTest[] {
    return [
      new PreTest(),
      new Action({
        name:'新增界面',
        url:'app/usersUi/addUsersUi',
        param:{
          itemId:'aaa',
          warehouseId:'${warehouse.warehouseId}',
          sort:1
        }
      }),
      new Action({
        name:'新增界面:增加菜单区',
        url:'app/usersUi/addUsersUi',
        param:{
          itemId:'bbb',
          warehouseId:'${warehouse.warehouseId}',
          sort:1,
          type:'downMenu'

        }
      }),
      new Action({
        name:'查询界面',
        url:'app/usersUi/getUsersUi',
        param:{
          warehouseId:'${warehouse.warehouseId}',


        }
      },{
        check(result){
          result = result.result;
          CheckUtil.expectEqualArray(result.homePage,[
            {itemId:'aaa'}
          ])

          CheckUtil.expectEqualArray(result.downMenu,[
            {itemId:'bbb'}
          ])
        }
      }),
      new Action({
        name:'新增界面',
        url:'app/usersUi/addUsersUi',
        param:{
          itemId:'bbb',
          warehouseId:'${warehouse.warehouseId}',
          sort:1
        }
      }),

      new Action({
        name:'批量保存',
        url:'app/usersUi/saveUsersUi',
        param:{
           
          warehouseId:'${warehouse.warehouseId}',
          array:[
            {
              type:'homePage',
              uis:[
                {
                  itemId:'aaa',
                  sort:4
                },
                {
                  itemId:'aaa1'
                }
              ]
            }
          ]

        }
      }),
      new Action({
        name:'查询界面',
        url:'app/usersUi/getUsersUi',
        param:{
          warehouseId:'${warehouse.warehouseId}',


        }
      },{
        check(result){
          result = result.result;
          CheckUtil.expectEqualArray(result.homePage,[
            {itemId:'aaa',sort:4},
            {itemId:'aaa1',sort:0}
          ])

          CheckUtil.expectEqualArray(result.downMenu,[
            {itemId:'bbb',sort:1}
          ])
        }
      }),
      new Action({
        name:'删除界面',
        url:'app/usersUi/delUsersUi',
        param:{
          warehouseId:'${warehouse.warehouseId}',
          itemId:'aaa1',
          type:'homePage'

        }
      }
      ),
      new Action({
        name:'查询界面',
        url:'app/usersUi/getUsersUi',
        param:{
          warehouseId:'${warehouse.warehouseId}',


        }
      },{
        check(result){
          result = result.result;
          CheckUtil.expectEqualArray(result.homePage,[
            {itemId:'aaa',sort:4}
          ])

          CheckUtil.expectEqualArray(result.downMenu,[
            {itemId:'bbb',sort:1}
          ])
        }
      }),
    ]

    
  }
  getName(){
    return '用户界面'
  }
}
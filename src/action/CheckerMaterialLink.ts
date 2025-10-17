import { ArrayUtil, BaseTest, CheckUtil, TestCase } from "testflow";
import QueryAction from "./QueryAction";
import IOpt from "../inf/IOpt";

export default class extends TestCase{
  getName(): string {
    return '检查material_link ,supplier,supplier_material表'
  }

  protected buildActions(): BaseTest[] {
    return [
      ... this.buildMaterialLink(),
      ... this.buildMaterial(true),
      ... this.buildSupplierMaterial(),
      ... this.buildSupplier(),
      ... this.buildMaterial(), 
    ]


  }


  private buildSupplier():BaseTest[]{
    let variable = this.getVariable()
    return [
      this.buildQuery('supplier',{
        warehouseType:'warehouse',
        check(result:any[]){
          CheckUtil.expectEqual(
            result.length,
            ArrayUtil.distinct(variable.supplierIds).length
          )
        }
      },{
        supplierId:'${supplierIds}'
      }),
      this.buildQuery('supplier',{
        warehouseType:'supplierWarehouse',
        check(result:any[]){
          CheckUtil.expectEqual(
            result.length,
            ArrayUtil.distinct(variable.linkSupplierIds).length
          )
        }
      },{
        supplierId:'${linkSupplierIds}'
      })
    ]
  }

  private buildSupplierMaterial():BaseTest[]{
    
    return [
      this.buildQuery('supplierMaterial',{
        warehouseType:'warehouse',
        buildVariable(result:any[]){
          return {
            'materialIds':ArrayUtil.toArray(result,'materialId'),
            'supplierIds':ArrayUtil.toArray(result,'supplierId')
          }
        }
      }),
      this.buildQuery('supplierMaterial',{
        warehouseType:'supplierWarehouse',
        buildVariable(result:any[]){
          return {
            'linkMaterialIds':ArrayUtil.toArray(result,'materialId'),
            'linkSupplierIds':ArrayUtil.toArray(result,'supplierId')
          }
        }
      })
    ]
  }

  private buildMaterial(notStrict?:boolean):BaseTest[]{
    let variable = this.getVariable();
    return [
      this.buildQuery('material',{
        warehouseType:'warehouse',
        check(result:any[]){
          if(!notStrict){
            CheckUtil.expectEqual(result.length,ArrayUtil.distinct(variable.materialIds).length)
          }else{
            CheckUtil.expectEqual(true,result.length>0)
          }
        }
      },{
        materialId:'${materialIds}'
      }),
      this.buildQuery('material',{
        warehouseType:'supplierWarehouse',
        check(result:any[]){
          CheckUtil.expectEqual(result.length,ArrayUtil.distinct(variable.linkMaterialIds).length)
        }
      },{
        materialId:'${linkMaterialIds}'
      })
    ]
  }

  private buildMaterialLink():BaseTest[]{
    return [
      this.buildQuery('materialLink',{
        warehouseType:'supplierWarehouse',
        check(result:any[]){
           
          CheckUtil.expectEqual(true,result.length>0,'应该有餐厅的materialLInk')
          
        },
        buildVariable(result:any[]) {
          return {

            materialIds:ArrayUtil.toArray(result,'materialId'),
            linkMaterialIds:ArrayUtil.toArray(result,'linkMaterialId'),
          }  
        }
      })  ,
      this.buildQuery('materialLink',{
        warehouseType:'warehouse',
        check(result:any[]){
          console.log('result',result)
          CheckUtil.expectEqual(true,result.length==0,'不应该有供应商的materialLInk')
          
        }
      })  
    ]
  }


  private buildQuery(tableName:string ,opt:IOpt,query?:any):BaseTest{
    if(query == null){
      query = {}
    }
    let warehouse = opt?.warehouseType ?? 'warehouse'
    return new QueryAction({
      url:'/free/query',
      query:{
        array:[
          {
            table:tableName,
            query:{
              ... query,
              warehouseGroupId:`\${${warehouse}.warehouseGroupId}`
            }
          }
        ]
      }
    },{
      check(result) {
        result = result.result
        if(opt.check){
          opt.check(result[tableName])
        }
      },
      buildVariable(result){
        result = result.result
        if(opt.buildVariable){
          return opt.buildVariable(result[tableName]);
        }
      }
    })
  }
  
}
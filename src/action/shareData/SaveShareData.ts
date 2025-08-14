import { HttpAction } from "testflow";
import UuidUtil from "../../util/UuidUtil";
import Action from "../Action";

interface TestOpt{
  data:any
}
export default class extends Action{
  private shareDataNo:string
  constructor(opt:TestOpt){
    super({
      name:'保存共享数据',
      url:'/app/shareData/saveShareData',
      param:{
        data:opt.data

      },

    })
  }

  protected parseHttpParam() {
    this.shareDataNo = UuidUtil.get();
    let param = super.parseHttpParam();
    param.shareDataNo = this.shareDataNo
    return param;
  }

  protected buildVariable(result: any) {
    return {
      shareDataNo:this.shareDataNo
    }
  }
}
import Action from "./Action";


export default class extends Action{
  constructor(){
    super({
      name: '全部计算',
      url: '/free/stateMaterial/recalStateMaterial',
      param: {
        warehouseId: '${warehouse.warehouseId}'
      }
    })
  }
}
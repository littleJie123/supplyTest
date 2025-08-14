import IOpt from "../inf/IOpt";

export default class WarehouseUtil {
  static getGroupId(afterProcess: IOpt) {
    let warehouse = afterProcess?.warehouseType ?? 'warehouse';
    return `\${${warehouse}.warehouseGroupId}`
  }
  static get(afterProcess: IOpt) {
    let warehouse = afterProcess?.warehouseType ?? 'warehouse';
    return {
      warehouseId: `\${${warehouse}.warehouseId}`,
      warehouseGroupId: `\${${warehouse}.warehouseGroupId}`,
    }
  }

  static getId(afterProcess: IOpt) {
    let warehouse = afterProcess?.warehouseType ?? 'warehouse';
    return {

      warehouseGroupId: `\${${warehouse}.warehouseGroupId}`,
    }
  }
}
import { IAfterProcess } from "testflow";

export type WarehouseType = 'warehouse' | 'supplierWarehouse' | 'warehouse2'

export default interface IOpt extends IAfterProcess{
  warehouseType?:WarehouseType
}
import { HttpAction } from "testflow";
import { WarehouseType } from "../../inf/IOpt";
interface Opt {
    type?: string;
    warehouseType?: WarehouseType;
}
export default class AddSupplier extends HttpAction {
    private name;
    constructor(name: any, opt?: Opt);
    protected buildVariable(result: any): {
        supplier: any;
    };
}
export {};

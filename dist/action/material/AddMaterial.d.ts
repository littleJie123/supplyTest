import { HttpAction } from "testflow";
import { WarehouseType } from "../../inf/IOpt";
interface Opt {
    buyUnit?: any[];
    suppliers?: any[];
    type?: WarehouseType;
}
export default class extends HttpAction {
    constructor(name: any, opt?: Opt);
    protected buildVariable(result: any): {
        lastMaterialId: any;
    };
}
export {};

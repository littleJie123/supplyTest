import { HttpAction } from "testflow";
interface Opt {
    buyUnit?: any[];
    suppliers?: any[];
}
export default class extends HttpAction {
    constructor(name: any, opt?: Opt);
    protected buildVariable(result: any): {
        lastMaterialId: any;
    };
}
export {};

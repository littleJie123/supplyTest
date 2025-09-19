import { HttpAction } from "testflow";
interface Opt {
    type?: string;
}
export default class AddSupplier extends HttpAction {
    private name;
    constructor(name: any, opt?: Opt);
    protected buildVariable(result: any): {
        supplier: any;
    };
}
export {};

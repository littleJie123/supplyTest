import { HttpAction } from "testflow";
export default class AddSupplier extends HttpAction {
    private name;
    constructor(name: any);
    protected buildVariable(result: any): {
        supplier: any;
    };
}

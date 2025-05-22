import { HttpAction, IHttpActionParam } from "fasttest";
export default class AddSupplier extends HttpAction {
    protected getDefHttpParam(): IHttpActionParam;
    protected buildVariable(result: any): {
        supplier: any;
    };
}

import { HttpAction, IHttpActionParam } from "testflow";
export default class extends HttpAction {
    protected getDefHttpParam(): IHttpActionParam;
    protected buildVariable(result: any): {
        noteItem: any;
    };
}

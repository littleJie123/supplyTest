import { HttpAction, IHttpActionParam } from "fasttest";
export default class extends HttpAction {
    protected getDefHttpParam(): IHttpActionParam;
    protected buildVariable(result: any): {
        note: any;
    };
}

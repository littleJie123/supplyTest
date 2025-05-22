import { HttpAction, IHttpActionParam } from "fasttest";
export default class extends HttpAction {
    protected getDefHttpParam(): IHttpActionParam;
    protected getHttpParam(): {
        warehouseId: string;
        noteId: string;
        items: any[];
        warehouseGroupId: string;
    };
}

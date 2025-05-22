import { HttpAction, IHttpActionParam } from "testflow";
export default class extends HttpAction {
    protected getDefHttpParam(): IHttpActionParam;
    protected getHttpParam(): {
        warehouseId: string;
        noteId: string;
        items: any[];
        warehouseGroupId: string;
    };
}

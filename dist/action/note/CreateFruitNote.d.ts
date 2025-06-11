import { HttpAction, IHttpActionParam } from "testflow";
export default class extends HttpAction {
    protected getDefHttpParam(): IHttpActionParam;
    getParamMeta(): {
        warehouseId: string;
        warehouseGroupId: string;
        materialId: string[];
    };
}

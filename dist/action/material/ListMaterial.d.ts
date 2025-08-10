import { HttpAction } from "testflow";
interface Opt {
    hasPurcharse?: number;
}
/**
 * 查询出物料，并且把物料放到materialMap中
 */
export default class extends HttpAction {
    private testOpt;
    constructor(opt?: Opt);
    protected buildVariable(result: any): {
        materialMap: any;
    };
    protected checkResult(result: any): Promise<void>;
}
export {};

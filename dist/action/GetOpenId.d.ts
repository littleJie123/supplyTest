import { UrlAction } from "fasttest";
export default class GetOpenId extends UrlAction {
    protected getMethod(): string;
    protected getHttpUrl(): string;
    protected buildVariable(result: any): {
        warehouse: any;
    };
    getName(): string;
}

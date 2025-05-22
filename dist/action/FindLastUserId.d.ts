import { UrlAction } from "fasttest";
export default class extends UrlAction {
    protected getHttpUrl(): string;
    protected buildVariable(result: any): {
        openid: string;
    };
    getName(): string;
}

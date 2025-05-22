import { UrlAction } from "testflow";
export default class extends UrlAction {
    protected getHttpUrl(): string;
    protected buildVariable(result: any): {
        openid: string;
    };
    getName(): string;
}

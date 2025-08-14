import { UrlAction } from "testflow";
export default class GetOpenId extends UrlAction {
    protected getMethod(): string;
    protected getHttpUrl(): string;
    protected buildVariable(result: any): {
        usersId: any;
        warehouse: any;
        token: any;
    };
    getName(): string;
}

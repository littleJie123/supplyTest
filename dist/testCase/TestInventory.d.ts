import { ITest, TestCase } from "testflow";
export default class extends TestCase {
    protected buildActions(): ITest[];
    getName(): string;
}

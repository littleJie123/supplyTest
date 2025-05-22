import { TestCase, ITest } from "testflow";
export default class extends TestCase {
    buildActions(): ITest[];
    getName(): string;
}

import { TestCase, ITest } from "testflow";
export default class TestError extends TestCase {
    buildActions(): ITest[];
    getName(): string;
}

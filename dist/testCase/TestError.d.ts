import { TestCase } from "fasttest";
import ITest from "fasttest/dist/inf/ITest";
export default class TestError extends TestCase {
    buildActions(): ITest[];
    getName(): string;
}

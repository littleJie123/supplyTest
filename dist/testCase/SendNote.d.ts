import { TestCase } from "fasttest";
import ITest from "fasttest/dist/inf/ITest";
export default class extends TestCase {
    buildActions(): ITest[];
    getName(): string;
}

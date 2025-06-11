import { BaseTest, TestCase } from "testflow";
export default class extends TestCase {
    getName(): string;
    protected buildActions(): BaseTest[];
}

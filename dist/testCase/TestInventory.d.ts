import { BaseTest, TestCase } from "testflow";
export default class extends TestCase {
    protected buildActions(): BaseTest[];
    getName(): string;
}

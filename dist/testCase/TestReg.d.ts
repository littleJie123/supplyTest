import { TestCase, BaseTest } from "testflow";
export default class extends TestCase {
    buildActions(): BaseTest[];
    getName(): string;
}

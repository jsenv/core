import { assert } from "@jsenv/assert";

export class FileContentNotFoundAssertionError extends assert.AssertionError {}
export class FileMissingAssertionError extends assert.AssertionError {}
export class ExtraFileAssertionError extends assert.AssertionError {}
export class FileContentAssertionError extends assert.AssertionError {}

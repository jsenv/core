import { snapshotTests } from "@jsenv/snapshot";

await snapshotTests(import.meta.url, () => {});

window.executionOrder.push("a_before_timeout");
await new Promise((resolve) => setTimeout(resolve, 500));
window.executionOrder.push("a_after_timeout");
export const answer = 42;

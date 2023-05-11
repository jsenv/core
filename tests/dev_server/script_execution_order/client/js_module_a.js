window.order.push("js_module_a");
await new Promise((resolve) => setTimeout(resolve, 500));
window.order.push("js_module_a_after_top_level_await");

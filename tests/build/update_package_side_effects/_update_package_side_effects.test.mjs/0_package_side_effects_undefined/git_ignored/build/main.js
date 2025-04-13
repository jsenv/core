import "/test_node_modules.js";

new URL("/js/foo.js", import.meta.url).href;

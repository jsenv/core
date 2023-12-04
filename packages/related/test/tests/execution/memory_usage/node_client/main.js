await new Promise((resolve) => setTimeout(resolve, 500));
global.array = Array(1e6).fill("some string");

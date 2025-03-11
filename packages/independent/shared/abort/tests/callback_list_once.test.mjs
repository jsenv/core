import { assert } from "@jsenv/assert";

import { createCallbackListNotifiedOnce } from "@jsenv/abort";

// remove before use
{
  const callbackList = createCallbackListNotifiedOnce();
  let callCount = 0;
  const remove = callbackList.add(() => {
    callCount++;
  });
  remove();
  callbackList.notify();
  const actual = {
    callCount,
  };
  const expect = {
    callCount: 0,
  };
  assert({ actual, expect });
}

// remove 2 while calling 1
{
  const callbackList = createCallbackListNotifiedOnce();
  let firstCallbackCallCount = 0;
  let secondCallbackCallCount = 0;
  callbackList.add(() => {
    firstCallbackCallCount++;
    remove2();
  });
  const remove2 = callbackList.add(() => {
    secondCallbackCallCount++;
  });
  callbackList.notify();
  const actual = {
    firstCallbackCallCount,
    secondCallbackCallCount,
  };
  const expect = {
    firstCallbackCallCount: 1,
    secondCallbackCallCount: 0,
  };
  assert({ actual, expect });
}

// remove 1 while calling 1 and there is 3
{
  const callbackList = createCallbackListNotifiedOnce();
  let firstCallbackCallCount = 0;
  let secondCallbackCallCount = 0;
  let thridCallbackCallCount = 0;
  const removeFirst = callbackList.add(() => {
    firstCallbackCallCount++;
    removeFirst();
  });
  callbackList.add(() => {
    secondCallbackCallCount++;
  });
  callbackList.add(() => {
    thridCallbackCallCount++;
  });
  callbackList.notify();
  const actual = {
    firstCallbackCallCount,
    secondCallbackCallCount,
    thridCallbackCallCount,
  };
  const expect = {
    firstCallbackCallCount: 1,
    secondCallbackCallCount: 1,
    thridCallbackCallCount: 1,
  };
  assert({ actual, expect });
}

// remove 2 while calling 1 and there is 3
{
  const callbackList = createCallbackListNotifiedOnce();
  let firstCallbackCallCount = 0;
  let secondCallbackCallCount = 0;
  let thridCallbackCallCount = 0;
  callbackList.add(() => {
    firstCallbackCallCount++;
    removeSecond();
  });
  const removeSecond = callbackList.add(() => {
    secondCallbackCallCount++;
  });
  callbackList.add(() => {
    thridCallbackCallCount++;
  });
  callbackList.notify();
  const actual = {
    firstCallbackCallCount,
    secondCallbackCallCount,
    thridCallbackCallCount,
  };
  const expect = {
    firstCallbackCallCount: 1,
    secondCallbackCallCount: 0,
    thridCallbackCallCount: 1,
  };
  assert({ actual, expect });
}

// remove 1 and 2 while calling 1 and there is 3
{
  const callbackList = createCallbackListNotifiedOnce();
  let firstCallbackCallCount = 0;
  let secondCallbackCallCount = 0;
  let thridCallbackCallCount = 0;
  const removeFirst = callbackList.add(() => {
    firstCallbackCallCount++;
    removeFirst();
    removeSecond();
  });
  const removeSecond = callbackList.add(() => {
    secondCallbackCallCount++;
  });
  callbackList.add(() => {
    thridCallbackCallCount++;
  });
  callbackList.notify();
  const actual = {
    firstCallbackCallCount,
    secondCallbackCallCount,
    thridCallbackCallCount,
  };
  const expect = {
    firstCallbackCallCount: 1,
    secondCallbackCallCount: 0,
    thridCallbackCallCount: 1,
  };
  assert({ actual, expect });
}

// remove 1 and 2 while calling 2 and there is 3
{
  const callbackList = createCallbackListNotifiedOnce();
  let firstCallbackCallCount = 0;
  let secondCallbackCallCount = 0;
  let thridCallbackCallCount = 0;
  const removeFirst = callbackList.add(() => {
    firstCallbackCallCount++;
  });
  const removeSecond = callbackList.add(() => {
    secondCallbackCallCount++;
    removeFirst();
    removeSecond();
  });
  callbackList.add(() => {
    thridCallbackCallCount++;
  });
  callbackList.notify();
  const actual = {
    firstCallbackCallCount,
    secondCallbackCallCount,
    thridCallbackCallCount,
  };
  const expect = {
    firstCallbackCallCount: 1,
    secondCallbackCallCount: 1,
    thridCallbackCallCount: 1,
  };
  assert({ actual, expect });
}

// call many
{
  const callbackList = createCallbackListNotifiedOnce();
  let firstCallbackCallCount = 0;
  let secondCallbackCallCount = 0;
  callbackList.add(() => {
    firstCallbackCallCount++;
  });
  callbackList.add(() => {
    secondCallbackCallCount++;
  });
  callbackList.notify();
  const actual = {
    firstCallbackCallCount,
    secondCallbackCallCount,
  };
  const expect = {
    firstCallbackCallCount: 1,
    secondCallbackCallCount: 1,
  };
  assert({ actual, expect });
}

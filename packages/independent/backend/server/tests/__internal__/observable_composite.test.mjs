import { assert } from "@jsenv/assert";

import {
  createCompositeProducer,
  createObservable,
} from "@jsenv/server/src/interfacing_with_node/observable.js";

const createObservableSource = () => {
  const observable = createObservable((callbacks) => {
    Object.assign(observable, callbacks);
  });
  return observable;
};

// notified from many observables
{
  const sourceA = createObservableSource();
  const sourceB = createObservableSource();
  const compositeProducer = createCompositeProducer();
  const compositeSource = createObservable(compositeProducer);
  compositeProducer.addObservable(sourceA);
  compositeProducer.addObservable(sourceB);
  const nextCalls = [];
  compositeSource.subscribe({
    next: (value) => {
      nextCalls.push(value);
    },
  });
  const nextCallsBefore = nextCalls.slice();
  sourceA.next("a");
  sourceB.next("b");

  const actual = {
    nextCallsBefore,
    nextCalls,
  };
  const expect = {
    nextCallsBefore: [],
    nextCalls: ["a", "b"],
  };
  assert({ actual, expect });
}

// can add after subscribe
{
  const source = createObservableSource();
  const compositeProducer = createCompositeProducer();
  const compositeSource = createObservable(compositeProducer);
  const nextCalls = [];
  compositeSource.subscribe({
    next: (value) => {
      nextCalls.push(value);
    },
  });

  compositeProducer.addObservable(source);

  const nextCallsBefore = nextCalls.slice();
  source.next("foo");

  const actual = {
    nextCallsBefore,
    nextCalls,
  };
  const expect = {
    nextCallsBefore: [],
    nextCalls: ["foo"],
  };
  assert({ actual, expect });
}

// can remove after subscribe
{
  const source = createObservableSource();
  const compositeProducer = createCompositeProducer();
  const compositeSource = createObservable(compositeProducer);
  compositeProducer.addObservable(source);
  const nextCalls = [];
  compositeSource.subscribe({
    next: (value) => {
      nextCalls.push(value);
    },
  });
  compositeProducer.removeObservable(source);

  const nextCallsBefore = nextCalls.slice();
  source.next("foo");

  const actual = {
    nextCallsBefore,
    nextCalls,
  };
  const expect = {
    nextCallsBefore: [],
    nextCalls: [],
  };
  assert({ actual, expect });
}

// subscription complete when all source are complete
{
  const sourceA = createObservableSource();
  const sourceB = createObservableSource();
  const compositeProducer = createCompositeProducer();
  const compositeSource = createObservable(compositeProducer);
  compositeProducer.addObservable(sourceA);
  compositeProducer.addObservable(sourceB);
  let completeCalled = false;
  compositeSource.subscribe({
    complete: () => {
      completeCalled = true;
    },
  });

  const completeCalledBefore = completeCalled;
  sourceA.complete();
  const completeCalledAfterSourceAComplete = completeCalled;
  sourceB.complete();
  const completeCalledAfterAllSourceComplete = completeCalled;

  const actual = {
    completeCalledBefore,
    completeCalledAfterSourceAComplete,
    completeCalledAfterAllSourceComplete,
  };
  const expect = {
    completeCalledBefore: false,
    completeCalledAfterSourceAComplete: false,
    completeCalledAfterAllSourceComplete: true,
  };
  assert({ actual, expect });
}

// subscription complete when last non completed source is removed
{
  const sourceA = createObservableSource();
  const sourceB = createObservableSource();
  const compositeProducer = createCompositeProducer();
  const compositeSource = createObservable(compositeProducer);
  compositeProducer.addObservable(sourceA);
  compositeProducer.addObservable(sourceB);
  let completeCalled = false;
  compositeSource.subscribe({
    complete: () => {
      completeCalled = true;
    },
  });

  const completeCalledBefore = completeCalled;
  sourceA.complete();
  const completeCalledAfterSourceAComplete = completeCalled;
  compositeProducer.removeObservable(sourceB);
  const completeCalledAfterSourceBRemoved = completeCalled;

  const actual = {
    completeCalledBefore,
    completeCalledAfterSourceAComplete,
    completeCalledAfterSourceBRemoved,
  };
  const expect = {
    completeCalledBefore: false,
    completeCalledAfterSourceAComplete: false,
    completeCalledAfterSourceBRemoved: true,
  };
  assert({ actual, expect });
}

// subscription complete when all source are complete
{
  const observable = createObservable(() => {});
  const compositeProducer = createCompositeProducer();
  const compositeSource = createObservable(compositeProducer);
  compositeProducer.addObservable(observable);
  let completeCalled = false;
  compositeSource.subscribe({
    complete: () => {
      completeCalled = true;
    },
  });
  const completeCalledBefore = completeCalled;
  compositeProducer.removeObservable(observable);

  const actual = {
    completeCalledBefore,
    completeCalled,
  };
  const expect = {
    completeCalledBefore: false,
    completeCalled: true,
  };
  assert({ actual, expect });
}

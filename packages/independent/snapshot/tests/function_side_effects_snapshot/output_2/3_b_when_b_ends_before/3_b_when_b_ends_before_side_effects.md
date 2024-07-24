1. console.warn
```console
collectFunctionSideEffects called while other function(s) side effects are collected
```

2. console.log
```console
b_before_timeout_50
```

3. return promise

4. console.log
```console
b_after_timeout_50
```

5. resolve
```js
undefined
```
1. console.log
```console
start
```

2. return promise

3. console.info
```console
timeout done
```

4. console.warn
```console
a warning after 2nd timeout
```

5. console.warn
```console
and an other warning
```

6. write file "toto.txt"
```txt
toto
```

7. reject
```undefined
Error: in the end we throw
  at file:///<root>/function_side_effects_snapshot_basic.test.mjs:83:11
  at async startTesting (file:///<root>/function_side_effects_snapshot_basic.test.mjs:31:5)
  at async file:///<root>/function_side_effects_snapshot_basic.test.mjs:41:1
```
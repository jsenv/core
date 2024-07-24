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
  at file:///cwd()/function_side_effects_snapshot.test.mjs:78:11
  at async file:///cwd()/function_side_effects_snapshot.test.mjs:18:7
  at async startTesting (file:///cwd()/function_side_effects_snapshot.test.mjs:31:5)
  at async file:///cwd()/function_side_effects_snapshot.test.mjs:36:1
```
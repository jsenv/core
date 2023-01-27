# runtimes/

Code implementing runtimes can be found here.

# Description

A runtime is an object with a "run" method.
The run method is roughly doing the following:

1. spawn a runtime (browser,Node.js)
2. set various listeners to monitor file execution
3. execute the file
4. return info about file execution (logs and errors for instance)

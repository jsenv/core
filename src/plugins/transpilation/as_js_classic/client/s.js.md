At the beginning s.js was added to ease jsenv ability to find the file.
In the end it is a modified version of the original systemjs because:

- jsenv uses systemjs format to generate code that is executed top level
  meant to be used with a classic `<script>` tag
  -> importmap removed from systemjs because it would force to wait for
  importmap. But it's ok because jsenv don't need importmap
  -> processing scripts removed from systemjs because we would have to wait
  for DOMLoaded etc. It's ok jsenv don't use this
- auto importing the first System.register in web workers
- queuing events in web workers

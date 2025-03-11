import readline from 'node:readline'
import  { PassThrough, Writable } from 'node:stream'


// to erase a line: \u001B[2K
// cursorup 1: \u001B[1A
// cursorup 2: \u001B[2A
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});
rl.on('line', (line) => {
    console.log(`Received: ${line}`);
  }); 
  rl.write('hello')
  rl.write('\nworld')
  // rl.write('\u001B[2K')
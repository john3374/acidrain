const ClosureCompiler = require('google-closure-compiler').compiler;

console.log(ClosureCompiler.COMPILER_PATH); // absolute path to the compiler jar
console.log(ClosureCompiler.CONTRIB_PATH); // absolute path to the contrib folder which contain externs

const closureCompiler = new ClosureCompiler({
  js: 'game.js',
  compilation_level: 'ADVANCED_OPTIMIZATIONS',
  js_output_file: 'game.min.js',
  createSourceMap: 'game.map'
});

const compilerProcess = closureCompiler.run((exitCode, stdOut, stdErr) => {
  console.log(exitCode, stdOut, stdErr);
});
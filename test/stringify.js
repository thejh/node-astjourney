var journey = require('..')
  , runInNewContext = require('vm').runInNewContext
  , test = require('tap').test

function recompileAndRun(t, code) {
  var ast = journey.makeAst(code)
  var newCode = journey.stringifyAst(ast)
  var oldResult = runInNewContext(code)
  var newResult = runInNewContext(code)
  t.deepEquals(newResult, oldResult, 'output of '+JSON.stringify(code)+' should stay the same')
}

test('stringify and run some basic snippets', function(t) {
  var snippets =
  [ '1+2+"foo"'
  , 'function foo(foo) { foo + arguments[1] }; foo(1, 2)'
  ]
  t.plan(snippets.length)
  snippets.forEach(function(snippet) {
    recompileAndRun(t, snippet)
  })
})

var journey = require('../')
  , fs = require('fs')
  , test = require('tap').test

var code = fs.readFileSync(__dirname+'/data/scopes.js', 'utf8')

test('method "a" contains the right declarations', function(t) {
  var ast = journey.makeAst(code)
  t.plan(4)
  journey.updateParentData(ast)
  journey.addScopeData(ast)
  var bazFunction
  journey.visitAll(ast, function(node) {
    if (node.type === 'defun' && node.name === 'baz') {
      if (bazFunction != null)
        bazFunction = "multiple"
      else
        bazFunction = node
    }
  })
  t.equal(typeof bazFunction, 'object')
  var scope = bazFunction.getScope().parent
  t.equal(scope && typeof scope.declaredVariables, 'object', 'scope.declaredVariables must be an object')
  t.equal(scope.node.name, 'a')
  t.deepEqual(Object.keys(scope.declaredVariables).sort(), ['foo', 'bar', 'baz'].sort())
})

test('method "b" contains the right declarations', function(t) {
  var ast = journey.makeAst(code)
  t.plan(4)
  journey.updateParentData(ast)
  journey.addScopeData(ast)
  var bFunction
  journey.visitAll(ast, function(node) {
    if (node.type === 'defun' && node.name === 'b') {
      if (bFunction != null)
        bFunction = "multiple"
      else
        bFunction = node
    }
  })
  t.equal(typeof bFunction, 'object')
  var scope = bFunction.getScope()
  t.equal(scope && typeof scope.declaredVariables, 'object', 'scope.declaredVariables must be an object')
  t.equal(scope.node.name, 'b')
  t.deepEqual(Object.keys(scope.declaredVariables).sort(), ['qux'].sort())
})

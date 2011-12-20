var journey = require('../')
  , fs = require('fs')
  , test = require('tap').test

test('find-requires', function (t) {
  var ast = journey.makeAst(fs.readFileSync(__dirname+'/data/requires.js', 'utf8'))
  var wanted = ['a', 'b', 'c', 'd']
  t.plan(wanted.length)
  journey.visitAll(ast, function(node) {
    if (node.type === 'call' && node.func.value === 'require' && node.args[0].type === 'string') {
      var i = wanted.indexOf(node.args[0].value)
      t.ok(i !== -1)
      if (i !== -1) wanted.splice(i, 1)
    }
  })
  wanted.forEach(function(wanted) {
    t.ok(false, "'"+wanted+"' wasn't found")
  })
})

test('require parents are calls', function(t) {
  var ast = journey.makeAst(fs.readFileSync(__dirname+'/data/requires.js', 'utf8'))
  t.plan(2 * 4)
  journey.visitAll(ast, function(node, parents) {
    if (node.type === 'name' && node.value === 'require') {
      t.equal(parents.last.type, 'call', 'parents of "require" names should be calls according to the walker')
    }
  })
  journey.updateParentData(ast)
  journey.visitAll(ast, function(node) {
    if (node.type === 'name' && node.value === 'require') {
      t.equal(node.parent.type, 'call', 'parents of "require" names should be calls according to the nodes')
    }
  })
})

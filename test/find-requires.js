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

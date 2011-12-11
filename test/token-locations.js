var journey = require('../')
  , fs = require('fs')
  , test = require('tap').test

test('locate-names', function (t) {
  var ast = journey.makeAst(fs.readFileSync(__dirname+'/data/requires.js', 'utf8'))
  var wanted =
  { baz: {line: 4, col: 12}
  , qux: {line: 9, col: 2}
  }
  t.plan(Object.keys(wanted).length)
  journey.visitAll(ast, function(node) {
    if (node.type === 'name' && Object.keys(wanted).indexOf(node.value) > -1) {
      t.has(node.position.startToken, wanted[node.value], JSON.stringify(node.value)+' has the correct position')
      delete wanted[node.value]
    }
  })
  Object.keys(wanted).forEach(function(wantedKey) {
    t.ok(false, JSON.stringify(wantedKey)+" wasn't found")
  })
})

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

test('check whether position data is present in own source', function (t) {
  var ast = journey.makeAst(fs.readFileSync(__dirname+'/../index.js', 'utf8'))
  journey.updateParentData(ast)
  var nodes = []
  journey.visitAll(ast, function(node) {
    if (node.type === 'toplevel') return
    nodes.push(node)
  })
  nodes.forEach(function(node) {
    t.ok(node.position != null, 'node with loc data (type: '+node.type+', parent type: '+node.parent.type
                               +', index in parent: '+node.parent.rawNode.indexOf(node.rawNode)+')')
    if (node.position != null) {
      // pos and endpos
      t.ok(node.position.startToken.pos <= node.position.endToken.pos, 'node starts before it ends (or at the same time), info from: '+node.rawNode[0].source)
    }
  })
  t.end()
})

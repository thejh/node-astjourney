(function() { // this is so that when you call uglifyjs on this file, it won't scream because of a toplevel return
var args = process.argv.slice(2)
if (args.length !== 2) return console.log('node boxednodes <jsfile> <htmldst>')
var sourcedata = require('fs').readFileSync(args[0], 'utf8')
var aj = require('../')
console.log('parsing...')
var ast = aj.makeAst(sourcedata)
console.log('parsing done')
sourcedata = sourcedata.split('') // lazy string stuff
sourcedata = sourcedata.map(function(char) {
  switch (char) {
    case '<': return '&lt;'
    case '>': return '&gt;'
    case '&': return '&amp;'
  }
  return char
})
aj.visitAll(ast, function(node) {
  if (node.type === 'toplevel') return
  if (!node.position) throw new Error(typeof node.rawNode[0])
  var from = node.position.startToken.pos
    , to = node.position.endToken.endpos
  if (from-1 < 0 || to+1 >= sourcedata.length) return
  sourcedata[from-1] += '<span style="border: 1px solid gray; background-color: rgba(255, 0, 0, 0.1); margin: 5px">'
  sourcedata[to+1] = '</span>' + sourcedata[to+1]
})
sourcedata = sourcedata.join('')
sourcedata = '<pre style="font-family: monospace">'+sourcedata+'</div>'
require('fs').writeFileSync(args[1], sourcedata)
})()

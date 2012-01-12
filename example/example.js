// Invocation: node example <srcfile> <dstfile>

var journey = require('../')
  , fs = require('fs')
  , has = Function.prototype.call.bind(Object.prototype.hasOwnProperty)

// read file
var code = fs.readFileSync(process.argv[2], 'utf8')
// make AST
var ast = journey.makeAst(code)
// grab toplevel function statements
var functions = {}
ast.statements.forEach(function(stat) {
  if (stat.type === 'defun') {
    console.log('defun found: '+stat.name)
    functions[stat.name] = stat
  }
})
// find function usages
var injections = {}
function firstFunction(parents) { return parents.filter(function(node) {return node.type in {'defun':1, 'function':1}})[0] }
journey.visitAll(ast, function(node, parents) {
  if (node.type !== 'call') return
  if (node.func.type !== 'name') return
  var funcname = node.func.value
  if (!has(functions, funcname)) return
  var func = functions[funcname]
  if (parents.indexOf(func) !== -1) return // recursion!
  injections[funcname] = injections[funcname] || []
  var rootfunc = firstFunction(parents)
  if (!rootfunc) throw new Error('meh! '+parents.map(function(node){return node.type}).join())
  if (injections[funcname].indexOf(rootfunc) !== -1) return
  injections[funcname].push(rootfunc)
  console.log('inject '+funcname+' into '+rootfunc.name)
})
// inject functions where needed
Object.keys(injections).forEach(function(funcname) {
  injections[funcname].forEach(function(rootfunc) {
    if (!functions[funcname]) throw new Error('meh.')
    rootfunc.body.push(functions[funcname])
    console.log('new rootfunc body:', rootfunc.body)
  })
})
// write out code
code = journey.stringifyAst(ast)
fs.writeFileSync(process.argv[3], code, 'utf8')

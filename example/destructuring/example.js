// Invocation: node example <srcfile> <dstfile>

var journey = require('../../')
  , fs = require('fs')
  , has = Function.prototype.call.bind(Object.prototype.hasOwnProperty)

// ugly, slow helper
journey.Node.prototype.replaceChild = function(oldChild, newChild) {
  function replace(obj, visited) {
    if (visited.indexOf(obj) !== -1 || typeof obj !== 'object' || obj == null) return
    visited.push(obj)
    Object.getOwnPropertyNames(obj).forEach(function(prop) {
      if ({}.__lookupGetter__.call(obj, prop)) return
      if (obj[prop] === oldChild) {
        obj[prop] = newChild
      } else {
        replace(obj[prop], visited)
      }
    })
  }
  replace(this, [])
}

// read file
var code = fs.readFileSync(process.argv[2], 'utf8')
// make AST
var ast = journey.makeAst(code)

function destructure(assignment) {
  if (assignment.type !== 'assign') throw new Error('non-assign-node')
  if (assignment.lvalue.type === 'array') {
    var seq = new journey.Node('seq')
    seq.exprs = assignment.lvalue.elements.map(function(element, i) {
      var rvalue = new journey.Node('sub')
      rvalue.expr = assignment.rvalue
      rvalue.subscript = new journey.Node('num', {value: i})
      var result = new journey.Node('assign', {op: true, lvalue: element, rvalue: rvalue})
      return destructure(result) || result
    })
    return seq
  } else if (assignment.lvalue.type === 'object') {
    var seq = new journey.Node('seq')
    seq.exprs = assignment.lvalue.props.map(function(element) {
      if (!element.value) throw new Error('unexpected getter/setter')
      var rvalue = new journey.Node('sub')
      rvalue.expr = assignment.rvalue
      rvalue.subscript = new journey.Node('string', {value: element.name})
      var result = new journey.Node('assign', {op: true, lvalue: element.value, rvalue: rvalue})
      return destructure(result) || result
    })
    return seq
  } else {
    return
  }
}

journey.visitAll(ast, function(node, parents) {
  if (node.type === 'assign') {
    var result = destructure(node)
    if (result) {
      parents.last.replaceChild(node, result)
    }
  }
})

// write out code
code = journey.stringifyAst(ast)
fs.writeFileSync(process.argv[3], code, 'utf8')

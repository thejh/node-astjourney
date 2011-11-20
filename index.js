var makeUglyAst = require('uglify-js').parser.parse;

exports.makeAst = makeAst
exports.visitAll = visitAll

function makeAst(code) {
  var ast = makeUglyAst(code)
  return transformNode(ast)
  
  function transformNode(uglyNode) {
    var prettyNode = {}
    var childSources = []
    prettyNode.__defineGetter__('children', function() {
      var result = []
      childSources.forEach(function(f){
        if (typeof f !== 'function') throw new Error(typeof f)
        result = result.concat(f())
      })
      return result
    })
    prettyNode.type = uglyNode[0]
    switch (prettyNode.type) {
      case 'string':
      case 'num':
      case 'name':
        prettyNode.value = uglyNode[1]
        break
      case 'toplevel':
      case 'block':
      case 'splice':
        prettyNode.statements = uglyNode[1].map(transformNode)
        childSources.push(function(){return prettyNode.statements})
        break
      case 'var':
      case 'const':
        prettyNode.vardefs = uglyNode[1].map(function(def) {
          var result = {name: def[0]}
          if (def.length > 1) {
            result.value = transformNode(def[1])
          }
          return result
        })
        childSources.push(function(){
          var result = []
          prettyNode.vardefs.map(function(def){
            if (def.value) result.push(def.value)
          })
          return result
        })
        break
      case 'try':
        prettyNode.tryBlock = uglyNode[1].map(transformNode)
        childSources.push(function(){return prettyNode.tryBlock})
        if (uglyNode[2] != null) {
          prettyNode.catchVar = uglyNode[2][0]
          prettyNode.catchBlock = uglyNode[2][1].map(transformNode)
        }
        childSources.push(function(){return prettyNode.catchBlock || []})
        if (uglyNode[3] != null) {
          prettyNode.finallyBlock = uglyNode[3].map(transformNode)
        }
        childSources.push(function(){return prettyNode.finallyBlock || []})
        break
      case 'throw':
      case 'return':
        prettyNode.expr = transformNode(uglyNode[1])
        childSources.push(function(){return [prettyNode.expr]})
        break
      case 'new':
      case 'call':
        prettyNode.func = transformNode(uglyNode[1])
        prettyNode.args = uglyNode[2].map(transformNode)
        childSources.push(function(){return [prettyNode.func].concat(prettyNode.args)})
        break
      case 'switch':
        prettyNode.expr = transformNode(uglyNode[1])
        childSources.push(function(){return [prettyNode.expr]})
        prettyNode.branches = uglyNode[2].map(function(branch) {
          var prettyBranch = {}
          if (branch[0]) {
            prettyBranch.expr = transformNode(branch[0])
          } else {
            prettyBranch.expr = null
          }
          prettyBranch.__defineGetter__('isDefault', function() {
            return prettyBranch.expr == null
          })
          prettyBranch.body = branch[1].map(transformNode)
          return prettyBranch
        })
        childSources.push(function(){
          var result = []
          prettyNode.branches.forEach(function(branch) {
            if (!branch.isDefault) {
              result.push(branch.expr)
            }
            result = result.concat(branch.body)
          })
          return result
        })
        break
      case 'break':
      case 'continue':
        prettyNode.label = uglyNode[1]
        break
      case 'conditional':
        prettyNode.condition = transformNode(uglyNode[1])
        prettyNode.ifExpr = transformNode(uglyNode[2])
        prettyNode.elseExpr = transformNode(uglyNode[3])
        childSources.push(function(){
          return [prettyNode.condition, prettyNode.ifExpr, prettyNode.elseExpr]
        })
        break
      case 'assign':
      case 'binary':
        prettyNode.op = uglyNode[1]
        prettyNode.lvalue = transformNode(uglyNode[2])
        prettyNode.rvalue = transformNode(uglyNode[3])
        childSources.push(function(){
          return [prettyNode.lvalue, prettyNode.rvalue]
        })
        break
      case 'dot':
        prettyNode.expr = transformNode(uglyNode[1])
        childSources.push(function(){
          return [prettyNode.expr]
        })
        prettyNode.property = uglyNode[2]
        if (uglyNode[3]) {
          throw new Error('whooops!')
        }
        break
      case 'function':
      case 'defun':
        prettyNode.name = uglyNode[1]
        prettyNode.args = uglyNode[2]
        prettyNode.body = uglyNode[3].map(transformNode)
        childSources.push(function(){return prettyNode.body})
        break
      case 'if':
        prettyNode.condition = transformNode(uglyNode[1])
        prettyNode.thenBlock = transformNode(uglyNode[2])
        prettyNode.elseBlock = uglyNode[3] ? transformNode(uglyNode[3]) : null
        childSources.push(function(){
          return [prettyNode.condition, prettyNode.thenBlock].concat(
            prettyNode.elseBlock?[prettyNode.elseBlock]:[]
          )
        })
        break
      case 'for':
        prettyNode.init = uglyNode[1] ? transformNode(uglyNode[1]) : null
        prettyNode.condition = uglyNode[2] ? transformNode(uglyNode[2]) : null
        prettyNode.step = uglyNode[3] ? transformNode(uglyNode[3]) : null
        prettyNode.body = transformNode(uglyNode[4])
        childSources.push(function(){
          var arr = []
          if (prettyNode.init) arr.push(prettyNode.init)
          if (prettyNode.condition) arr.push(prettyNode.condition)
          if (prettyNode.step) arr.push(prettyNode.step)
          arr.push(prettyNode.body)
          return arr
        })
        break
      case 'for-in':
        prettyNode.init = transformNode(uglyNode[1])
        prettyNode.key = transformNode(uglyNode[2])
        prettyNode.object = transformNode(uglyNode[3])
        prettyNode.body = transformNode(uglyNode[4])
        childSources.push(function(){
          return [prettyNode.init, prettyNode.key, prettyNode.object, prettyNode.body]
        })
        break
      case 'while':
      case 'do':
        prettyNode.condition = transformNode(uglyNode[1])
        prettyNode.body = transformNode(uglyNode[2])
        childSources.push(function(){
          return [prettyNode.condition, prettyNode.body]
        })
        break
      case 'unary-prefix':
      case 'unary-postfix':
        prettyNode.op = uglyNode[1]
        prettyNode.expr = transformNode(uglyNode[2])
        childSources.push(function(){
          return [prettyNode.expr]
        })
        break
      case 'sub':
        prettyNode.expr = transformNode(uglyNode[1])
        prettyNode.subscript = transformNode(uglyNode[2])
        childSources.push(function(){
          return [prettyNode.expr, prettyNode.subscript]
        })
        break
      case 'object':
        prettyNode.props = uglyNode[1].map(function(prop) {
          if (prop.length === 2) {
            return {name: prop[0], value: transformNode(prop[1])}
          } else if (prop[2] === 'get') {
            return {name: prop[0], getter: transformNode(prop[1])}
          } else if (prop[2] === 'set') {
            return {name: prop[0], setter: transformNode(prop[1])}
          } else {
            throw new Error('uglifyjs does weird stuff')
          }
        })
        childSources.push(function(){
          var arr = []
          prettyNode.props.forEach(function(prop) {
            arr.push(prop.value || prop.getter || prop.setter)
          })
          return arr
        })
        break
      case 'regexp':
        prettyNode.regexp = uglyNode[1]
        prettyNode.modifiers = uglyNode[2]
        break
      case 'array':
        prettyNode.elements = uglyNode[1].map(transformNode)
        childSources.push(function(){
          return prettyNode.elements
        })
        break
      case 'stat':
        prettyNode.stat = transformNode(uglyNode[1])
        childSources.push(function(){return [prettyNode.stat]})
        break
      case 'seq':
        prettyNode.exprs = uglyNode.slice(1).map(transformNode)
        childSources.push(function(){return prettyNode.exprs})
        break
      case 'label':
        prettyNode.name = uglyNode[1]
        prettyNode.loop = transformNode(uglyNode[2])
        childSources.push(function(){return [prettyNode.loop]})
        break
      case 'with':
        prettyNode.object = transformNode(uglyNode[1])
        prettyNode.body = transformNode(uglyNode[2])
        childSources.push(function(){return [prettyNode.object, prettyNode.body]})
        break
      case 'atom':
        prettyNode.name = uglyNode[1]
        break
      default:
        throw new Error('unknown node type '+uglyNode[0])
    }
    return prettyNode
  }
}

function visitAll(node, cb) {
  node.children.forEach(function(child) {
    visitAll(child, cb)
  })
  cb(node)
}

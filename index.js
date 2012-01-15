var makeUglyAst = require('uglify-js').parser.parse;
var uglyGenCode = require('uglify-js').uglify.gen_code;

// ==== EXPORTS ====
exports.makeAst = makeAst
exports.visitAll = visitAll
exports.updateParentData = updateParentData
exports.addScopeData = addScopeData
exports.stringifyAst = stringifyAst
exports.Node = Node
exports.Scope = Scope

// ==== NODE ====
function Node(type, data) {
  var self = this

  this.type = type
  this.parent = null
  this.scope = null
  if (data) Object.keys(data).forEach(function(key) {
    self[key] = data[key]
  })
}

Node.prototype.getScope = function() {
  var node = this
  while (node && !node.scope) {
    node = node.parent
  }
  if (node.scope) return node.scope
  throw new Error('could not find scope, use addScopeData and updateParentData to regenerate data')
}

// ==== SCOPE ====
function Scope(options) {
  this.parent = null
  this.node = null
  this.children = []
  this.variableUses = {}
  this.declaredVariables = {}
    
  joinObj(this, options)
}
  
Scope.prototype.addVariableUsage = function(name, node) {
  if (!this.variableUses.hasOwnProperty(name)) {
    this.variableUses[name] = []
  }
  this.variableUses[name].push({node:node})
}
  
Scope.prototype.addDeclaration = function(name, node, value) {
  if (!this.declaredVariables.hasOwnProperty(name)) {
    this.declaredVariables[name] = []
  }
  this.declaredVariables[name].push({node:node, value:value})
}
  
Scope.prototype.getVariablesScope = function(name) {
  var scope = this
  while (scope && !scope.declaredVariables.hasOwnProperty(name)) {
    scope = scope.parent
  }
  return scope
}

function makeAst(code) {
  var ast = makeUglyAst(code)
  return transformNode(ast)
  
  function transformNode(uglyNode) { try {
    var prettyNode = new Node(uglyNode[0])
    var childSources = []
    prettyNode.__defineGetter__('children', function() {
      var result = []
      childSources.forEach(function(f){
        if (typeof f !== 'function') throw new Error(typeof f)
        result = result.concat(f())
      })
      return result
    })
    switch (prettyNode.type) {
      case 'string':
      case 'num':
      case 'name':
        prettyNode.value = uglyNode[1]
        break
      case 'toplevel':
      case 'block':
      case 'splice':
        if (uglyNode[1]) {
          prettyNode.statements = uglyNode[1].map(transformNode)
        }
        childSources.push(function(){return prettyNode.statements || []})
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
        if (uglyNode[1] != null) {
          prettyNode.expr = transformNode(uglyNode[1])
        }
        childSources.push(function(){return prettyNode.expr ? [prettyNode.expr] : []})
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
        throw new Error('unknown node type '+JSON.stringify(prettyNode.type))
    }
    return prettyNode
  } catch (e) {e.stack = 'Error in node '+JSON.stringify(uglyNode)+'\n'+e.stack; throw e}}
}

function stringifyAst(ast, opts) {
  ast = transformNode(ast)
  return uglyGenCode(ast, opts)

  function transformNode(prettyNode) {
    // don't attach properties here, e.g. a seq will be
    // `arr=arr.concat()`ted later.
    var uglyNode = [prettyNode.type]

    switch (prettyNode.type) {
      case 'string':
      case 'num':
      case 'name':
        uglyNode.push(prettyNode.value)
        break
      case 'toplevel':
      case 'block':
      case 'splice':
        uglyNode.push(prettyNode.statements ?
          prettyNode.statements.map(transformNode)
        : null)
        break
      case 'var':
      case 'const':
        uglyNode[1] = prettyNode.vardefs.map(function(def) {
          var result = [def.name]
          if (def.value) {
            result.push(transformNode(def.value))
          }
          return result
        })
        break
      case 'try':
        uglyNode.push(prettyNode.tryBlock.map(transformNode))
        
        if (prettyNode.catchBlock) {
          uglyNode.push(
          [ prettyNode.catchVar
          , prettyNode.catchBlock.map(transformNode)
          ])
        } else uglyNode.push(null)
        
        if (prettyNode.finallyBlock) {
          uglyNode.push(prettyNode.finallyBlock.map(transformNode))
        } else uglyNode.push(null)
        
        break
      case 'throw':
      case 'return':
        if (prettyNode.expr) {
          uglyNode.push(transformNode(prettyNode.expr))
        } else uglyNode.push(null)
        break
      case 'new':
      case 'call':
        uglyNode.push(transformNode(prettyNode.func))
        uglyNode.push(prettyNode.args.map(transformNode))
        break
      case 'switch':
        uglyNode.push(transformNode(prettyNode.expr))
        uglyNode.push(prettyNode.branches.map(function(branch) {
          var uglyBranch = []
          uglyBranch.push(prettyBranch.expr != null ?
            transformNode(prettyBranch.expr)
          :
            null
          )
          branch.push(prettyBranch.body.map(transformNode))
          return uglyBranch
        }))
        break
      case 'break':
      case 'continue':
        uglyNode.push(prettyNode.label)
        break
      case 'conditional':
        uglyNode.push(transformNode(prettyNode.condition))
        uglyNode.push(transformNode(prettyNode.ifExpr))
        uglyNode.push(transformNode(prettyNode.elseExpr))
        break
      case 'assign':
      case 'binary':
        uglyNode.push(prettyNode.op)
        uglyNode.push(transformNode(prettyNode.lvalue))
        uglyNode.push(transformNode(prettyNode.rvalue))
        break
      case 'dot':
        uglyNode.push(transformNode(prettyNode.expr))
        uglyNode.push(prettyNode.property)
        break
      case 'function':
      case 'defun':
        uglyNode.push(prettyNode.name)
        uglyNode.push(prettyNode.args)
        uglyNode.push(prettyNode.body.map(transformNode))
        break
      case 'if':
        uglyNode.push(transformNode(prettyNode.condition))
        uglyNode.push(transformNode(prettyNode.thenBlock))
        uglyNode.push(prettyNode.elseBlock ?
          transformNode(prettyNode.elseBlock)
        :
          null
        )
        break
      case 'for':
        uglyNode.push(prettyNode.init ?
          transformNode(prettyNode.init)
        :
          null
        )
        uglyNode.push(prettyNode.condition ?
          transformNode(prettyNode.condition)
        :
          null
        )
        uglyNode.push(prettyNode.step ?
          transformNode(prettyNode.step)
        :
          null
        )
        uglyNode.push(transformNode(prettyNode.body))
        break
      case 'for-in':
        uglyNode.push(transformNode(prettyNode.init))
        uglyNode.push(transformNode(prettyNode.key))
        uglyNode.push(transformNode(prettyNode.object))
        uglyNode.push(transformNode(prettyNode.body))
        break
      case 'while':
      case 'do':
        uglyNode.push(transformNode(prettyNode.condition))
        uglyNode.push(transformNode(prettyNode.body))
        break
      case 'unary-prefix':
      case 'unary-postfix':
        uglyNode.push(prettyNode.op)
        uglyNode.push(transformNode(prettyNode.expr))
        break
      case 'sub':
        uglyNode.push(transformNode(prettyNode.expr))
        uglyNode.push(transformNode(prettyNode.subscript))
        break
      case 'object':
        uglyNode.push(prettyNode.props.map(function(prop) {
          if (prop.value) {
            return [prop.name, transformNode(prop.value)]
          } else if (prop.getter) {
            return [prop.name, transformNode(prop.getter), 'get']
          } else if (prop.setter) {
            return [prop.name, transformNode(prop.setter), 'set']
          } else {
            throw new Error('my code does weird stuff')
          }
        }))
        break
      case 'regexp':
        uglyNode.push(prettyNode.regexp)
        uglyNode.push(prettyNode.modifiers)
        break
      case 'array':
        uglyNode.push(prettyNode.elements.map(transformNode))
        break
      case 'stat':
        uglyNode.push(transformNode(prettyNode.stat))
        break
      case 'seq':
        uglyNode = uglyNode.concat(prettyNode.exprs.map(transformNode))
        break
      case 'label':
        uglyNode.push(prettyNode.name)
        uglyNode.push(transformNode(prettyNode.loop))
        break
      case 'with':
        uglyNode.push(transformNode(prettyNode.object))
        uglyNode.push(transformNode(prettyNode.body))
        break
      case 'atom':
        uglyNode.push(prettyNode.name)
        break
      default:
        throw new Error('unknown node type '+JSON.stringify(prettyNode.type))
    }
    return uglyNode
  }
}

function updateParentData(ast) {
  visitAll(ast, function(node, parents) {
    node.parent = parents.last
  })
}

function addScopeData(ast) {
  if (!ast.type === 'toplevel') throw new Error('expecting a toplevel node on top')
  
  var SCOPE_BORDER = ['toplevel', 'function', 'defun']
  
  var scopeStack = []
  var scope = null
  visitAll(ast, function(node, nodeParents) {
    if (SCOPE_BORDER.indexOf(node.type) !== -1) {
      scopeStack.pop()
      scope = scopeStack[scopeStack.length-1]
    }
    if (node.type === 'name') {
      scope.addVariableUsage(node.value, node)
    }
    if (node.type === 'var' || node.type === 'const') {
      node.vardefs.forEach(function(def) {
        scope.addDeclaration(def.name, node, def.value)
      })
    }
    if (node.type === 'defun') {
      scope.addDeclaration(node.name, node, node)
    }
  }, {preCb: function(node, nodeParents) {
    if (SCOPE_BORDER.indexOf(node.type) !== -1) {
      var newScope = new Scope({parent: scope, node: node})
      if (scope) scope.children.push(newScope)
      scope = newScope
      node.scope = scope
      scopeStack.push(scope)
    }
  }})
}

function visitAll(node, cb, options) {
  options = options || {}
  var parents = options.parents || []
  var childsParents = parents.concat([node])
  childsParents.last = node
  if (options.preCb) options.preCb(node, parents)
  node.children.forEach(function(child) {
    visitAll(child, cb, cloneWith(options, {parents: childsParents}))
  })
  cb(node, parents)
}


// ==== HELPERS ====
function joinObj(base, joined) {
  Object.keys(joined).forEach(function(key) {
    base[key] = joined[key]
  })
}

function cloneWith(base, joined) {
  var result = {}
  joinObj(result, base)
  joinObj(result, joined)
  return result
}

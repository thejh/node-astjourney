[![Build Status](https://secure.travis-ci.org/thejh/node-astjourney.png?branch=master)](http://travis-ci.org/thejh/node-astjourney?branch=master)

astjourney is a library for reading, traversing and writing javascript ASTs. It uses uglify-js under the hood, but tries to give you a nicer interface.


Methods
=======
Creating an AST from a string of code:

    var ast = astjourney.makeAst(code)

Walking the AST. Depth-first, but you can also specify a breadth-first callback as `options.preCb`. `ast` can also be a node from the AST - in that case, this only traverses its children.

    astjourney.visitAll(ast, function(node, parents) {
      // called for each node in the AST
      // parents[parents.length-1] is the parent (shortcut: parents.last)
    }[, options])

Attaching `parent` properties pointing to the parent nodes to all nodes (must be called again after AST changes):

    astjourney.updateParentData(ast)

Attaching `scope` properties to scope root nodes (must be called again after AST changes):

    astjourney.addScopeData(ast)

Generating code from an AST (`opts` are optional, they get passed through to `uglifyjs.gen_code`, you can e.g. specify that you don't want your code to be one big line):

    var code = astjourney.stringifyAst(ast[, opts])


AST nodes
===================
Generic properties:

 - `type` is a string containing the type of the node, a list of types is in the next section.
 - `children` is an array that contains all child nodes of the given node combined. This is a getter that creates a new array on access,
   changing the array has no effect.
 - `parent` is the parent node (doesn't get updated automatically, not present by default, generate it with `astjourney.updateParentData`).
 - `scope` is the scope of which this node is the root element or `null` (doesn't get updated automatically, not present by default, generate it with `astjourney.addScopeData`).


Generic methods:

 - `getScope()` walks up the parent chain (parent data must be correct) until it hits a node with a scope (scope data must be correct).


Scopes
======
Properties (there might be some other undocumented ones, too, but these are the ones that should remain this way):

 - `parent` is the parent scope.
 - `node` is the node inside of which this scope is. It is a `toplevel`, a `defun` or a `function` node.
 - `declaredVariables` is an object whose keys are local names that are defined in this scope.
 - `children` is an array of child scopes.


Node Types
==========
string
--------
A string literal like `"foo"`.

Properties:

 - `value` is a string containing its unescaped value.


num
-----
A number literal like `123`.

Properties:

 - `value` is a number containing its value.


name
------
A variable name, e.g. the `foo` in `foo(123)` or `foo.bar`. Warning: `bar` is not a name! Also, the variable name is unescaped, so `ww\u0077` in the source becomes `www`.

Properties:

 - `value` is a string containing the unescaped variable name.


toplevel
----------
This is the top-level node of every AST.

Properties:

 - `statements` is an array of statements.


block
-------
This is a `{}` block of statements. Note that not everything that looks like a block is represented by a block node - for example, try/catch/finally uses arrays of statements.

Properties:

 - `statements` is an array of statements or undefined.


splice
--------
Uh... honestly, no idea, but it has the same properties as a `block`.


var and const
-----------------
This node contains one or multiple variable declarations, each one with or without a value. If it's a `const`, the variables values cannot be altered later.

Properties:

 - `vardefs` is an array of objects like `{name: variableName, value: valueNode}` or `{name: variableName}`.


try
-----
This node represents a `try` block with at least either a `catch` clause or a `finally` clause, maybe also both. Each block or clause is either an array of statements or undefined (if that clause doesn't exist).

Properties:

 - `tryBlock` is an array containing the statements in the `try` block.
 - `catchVar` is a string containing the name of the variable of the caught value in the `catch` clause or `undefined` if no such clause exists.
 - `catchBlock` is an array containing the statements in the `catch` clause or `undefined` if no such clause exists.
 - `finallyBlock` is an array containing the statements in the `finally` clause or `undefined` if no such clause exists.


throw and return
--------------------
These nodes represent `throw` or `return` statements. They have an `expr` property containing the returned or thrown expression unless the node is a `return` statement without an expression.

Properties:

 - `expr` is the thrown/returned node or `undefined` if the node is a no-expr `return`.


new and call
----------------
These nodes represent function calls (`new` like `new f(a, b, c)`, `call` like `f(a, b, c)`).

Properties:

 - `func` is a node which represents the callee.
 - `args` is an array of expressions which represent the function arguments.


switch
--------
This node represents a switch-case statement. Note that code execution hops to the next branch if there's nothing that stops it.

Properties:

 - `expr` is a node and the `foo` in `switch (foo) {}`.
 - `branches` is an array of branches with the following properties:
  - `expr` is the expression after `case`, e.g. the `foo` in `case foo:`, or `null` if this is the `default` branch.
  - `body` is an array containing the statements in this branch.


break and continue
----------------------
These nodes represent `break` and `continue` statements with or without label.

Properties:

 - `label` is the name of a label or `undefined`.


conditional
-------------
This node represents the ternary operator (`a ? b : c').

Properties:

 - `condition` is the condition expression (`a` in the example).
 - `ifExpr` is the expression that gets evaluated in case of truthyness (`b` in the example).
 - `elseExpr` is the expression that gets evaluated in case of falsyness (`c` in the example).


assign and binary
---------------------
These nodes represent binary operations. `assign` is the name of nodes that do assignments, `binary` is the name of all others.

Properties:

 - `op` is a string representing the operation or `true` if it's a simple assignment. For all other assignments
   (`+=`, `-=`, `/=`, `*=`, `%=`, `>>=`, `<<=`, `>>>=`, `|=`, `^=`, `&=`), it is the operations symbol without `=`.
   For other operations, it's just the symbol.
 - `lvalue` is the left-hand expression.
 - `rvalue` is the right-hand expression.


dot
-----
This node is a member access as in `a.b`.

Properties:

 - `expr` is the left-hand expression (here: `a`).
 - `property` is a string containing the members name (here: `"b"`).


function and defun
----------------------
These nodes represent functions. While `function` is a function expression, `defun` is a function declaration.

Properties:

 - `name` contains the functions name as a string or `null` if it has none.
 - `args` is an array containing strings representing the argument names.
 - `body` is an array containing nodes.


if
----
This node represents an `if` statement, sometimes with an `else` clause.

Properties:

 - `condition` is an expression and, well, the condition.
 - `thenBlock` is a node representing the first block or statement (not an array!).
 - `thenBlock` is a node representing the `else` block or statement (not an array!) or `null`.


for
-----
This node represents a `for (init, condition, step) body` node.

Properties:

 - `init` is a node or `null`.
 - `condition` is a node or `null`.
 - `step` is a node or `null`.
 - `body` is a node (not an array!).


for-in
--------
This node represents a `for (init: object) body` node.

Properties:

 - `init` is a `var` statement or a `name` node.
 - `key` is a `name` node representing the key.
 - `object` is a node containing the right-hand expression.
 - `body` is a node (not an array!).


while and do
----------------
These nodes represent `while` loops. `while` means `while (condition) body`, `do` means `do body while (condition)`.

Properties:

 - `condition` is a node or `null`.
 - `body` is a node (not an array!).


unary-prefix and unary-postfix
----------------------------------
These nodes represent unary operations.

Properties:

 - `op` is a string containing the symbol.
 - `expr` is the base expression.


sub
-----
This node is used for the subscript syntax `expr[subscript]`.

Properties:

 - `expr` is an expression.
 - `subscript` is an expression, too.


object
--------
This node represents an object literal.

Properties:

 - `props` is an array of properties. Each of them has a `name` property and either a `value`, a `getter` or a `setter` property containing an expression.


array
-------
This node represents an array literal. Warning: `undefined` becomes a `name`, holes in the array (as in `[1,,2]`) become `atom`s with an `undefined` value.

Properties:

 - `elements` is an array of expressions.


regexp
--------
This node represents a regular expression like `/regexp/modifiers`.

Properties:

 - `regexp` is a string.
 - `modifiers` is a string (may be empty).


stat
------
This node is a wrapper that makes statements out of expressions.

Properties:

 - `stat` is an expression.


seq
-----
This node represents a list of comma-seperated expressions as in `[(a,b,c)]`.

Properties:

 - `exprs` is an array of expressions.


label
-------
This node represents a label and the statement it labels like `label: loop`.

Properties:

 - `name` is a string.
 - `loop` is an expression.


with
------
This node represents a `with (object) body` statement.

Properties:

 - `object` is an expression.
 - `body` is a node.


atom
------
This node represents an atom like `false`, `true` or `null`. Important: The `undefined` atom is used for sparse arrays, not for the `undefined` variable!

Properties:

 - `name` contains the atom as a string.

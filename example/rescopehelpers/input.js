function foo(a) {
  return a+3
}

var doc = {}

doc.foo = function doc_foo(a, b) {
  return foo(a) + foo(b)
}

// Shared by QML and the tests. Input is parsed as mathematics, never as code.
var constants = { pi: Math.PI, tau: 2 * Math.PI, e: Math.E }
var functions = {
  abs: [1, Math.abs], ceil: [1, Math.ceil], floor: [1, Math.floor],
  round: [1, Math.round], sqrt: [1, Math.sqrt], cbrt: [1, Math.cbrt],
  exp: [1, Math.exp], ln: [1, Math.log], log: [1, Math.log10],
  log10: [1, Math.log10], log2: [1, Math.log2],
  sin: [1, Math.sin], cos: [1, Math.cos], tan: [1, tangent],
  asin: [1, Math.asin], acos: [1, Math.acos], atan: [1, Math.atan],
  sinh: [1, Math.sinh], cosh: [1, Math.cosh], tanh: [1, Math.tanh],
  deg: [1, function(x) { return x * 180 / Math.PI }],
  rad: [1, function(x) { return x * Math.PI / 180 }],
  pow: [2, Math.pow], atan2: [2, Math.atan2],
  min: [2, Math.min], max: [2, Math.max], hypot: [2, Math.hypot]
}

function owns(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function fail(message) {
  throw new Error(message)
}

function finite(value) {
  if (isNaN(value)) fail("Outside the real-number domain")
  if (!isFinite(value)) fail("Result is too large")
  return value
}

function tangent(value) {
  if (Math.abs(Math.cos(value)) < 1e-15) fail("Tangent is undefined here")
  return Math.tan(value)
}

function factorial(value) {
  if (value < 0 || Math.floor(value) !== value) fail("Factorial needs a nonnegative integer")
  if (value > 170) fail("Factorial is too large")
  var result = 1
  for (var i = 2; i <= value; i++) result *= i
  return result
}

function normalize(input) {
  return input.toLowerCase()
    .replace(/−/g, "-").replace(/[×·]/g, "*").replace(/÷/g, "/")
    .replace(/π/g, "pi").replace(/τ/g, "tau").replace(/√/g, "sqrt")
    .replace(/\bdivided\s+by\b/g, "/").replace(/\bmultiplied\s+by\b/g, "*")
    .replace(/\bplus\b/g, "+").replace(/\bminus\b/g, "-").replace(/\btimes\b/g, "*")
    .replace(/\*\*/g, "^")
}

function tokenize(source) {
  var tokens = []
  var offset = 0
  while (offset < source.length) {
    var rest = source.slice(offset)
    var space = /^\s+/.exec(rest)
    if (space) { offset += space[0].length; continue }
    var number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/.exec(rest)
    var name = /^[a-z][a-z0-9_]*/.exec(rest)
    if (number) {
      tokens.push({ kind: "number", value: finite(Number(number[0])) })
      offset += number[0].length
    } else if (name) {
      tokens.push({ kind: "name", value: name[0] })
      offset += name[0].length
    } else if ("+-*/^%!(),".indexOf(rest[0]) !== -1) {
      tokens.push({ kind: rest[0], value: rest[0] })
      offset++
    } else {
      fail("Unsupported character")
    }
    if (tokens.length > 256) fail("Expression is too long")
  }
  tokens.push({ kind: "end" })
  return tokens
}

function Parser(tokens) {
  this.tokens = tokens
  this.position = 0
  this.depth = 0
}

Parser.prototype.kind = function() { return this.tokens[this.position].kind }
Parser.prototype.take = function(kind) {
  if (this.kind() !== kind) return false
  this.position++
  return true
}
Parser.prototype.expect = function(kind) {
  if (!this.take(kind)) fail(this.kind() === "end" ? "Incomplete expression" : "Expected " + kind)
}

Parser.prototype.expression = function() {
  var value = this.product()
  while (this.kind() === "+" || this.kind() === "-") {
    var add = this.take("+")
    if (!add) this.expect("-")
    var right = this.product()
    value = finite(add ? value + right : value - right)
  }
  return value
}

Parser.prototype.product = function() {
  var value = this.unary()
  while (true) {
    var kind = this.kind()
    if (kind === "*" || kind === "/") {
      this.position++
      var right = this.unary()
      if (kind === "/" && right === 0) fail("Cannot divide by zero")
      value = finite(kind === "*" ? value * right : value / right)
    } else if (kind === "(" || kind === "name") {
      // Juxtaposition has the same precedence as multiplication: 6/2(3) = 9.
      value = finite(value * this.unary())
    } else {
      return value
    }
  }
}

Parser.prototype.unary = function() {
  if (++this.depth > 64) fail("Expression is nested too deeply")
  var value
  if (this.take("+")) value = this.unary()
  else if (this.take("-")) value = -this.unary()
  else value = this.power()
  this.depth--
  return value
}

Parser.prototype.power = function() {
  var value = this.postfix()
  // Exponentiation is right-associative and binds more tightly than a sign.
  if (this.take("^")) value = finite(Math.pow(value, this.unary()))
  return value
}

Parser.prototype.postfix = function() {
  var value = this.primary()
  while (this.kind() === "!" || this.kind() === "%") {
    if (this.take("!")) value = factorial(value)
    else { this.expect("%"); value /= 100 }
  }
  return value
}

Parser.prototype.primary = function() {
  var token = this.tokens[this.position]
  if (this.take("number")) return token.value
  if (this.take("(")) {
    var grouped = this.expression()
    this.expect(")")
    return grouped
  }
  if (this.take("name")) {
    if (owns(constants, token.value)) return constants[token.value]
    if (!owns(functions, token.value)) fail("Unknown function or constant")
    var spec = functions[token.value]
    this.expect("(")
    var args = [this.expression()]
    while (this.take(",")) {
      if (args.length >= spec[0]) fail("Too many function arguments")
      args.push(this.expression())
    }
    this.expect(")")
    if (args.length !== spec[0]) fail("Wrong number of function arguments")
    return finite(spec[1].apply(null, args))
  }
  fail(this.kind() === "end" ? "Incomplete expression" : "Expected a number")
}

function format(value) {
  // Fifteen significant digits hide common binary rounding noise, not small values.
  return String(Number(value.toPrecision(15)))
}

function calculate(input) {
  if (typeof input !== "string" || input.length > 1024)
    return { error: "Expression is too long" }
  try {
    var parser = new Parser(tokenize(normalize(input)))
    var value = finite(parser.expression())
    parser.expect("end")
    return { value: value, text: format(value) }
  } catch (error) {
    return { error: error.message }
  }
}

function result(input) {
  if (typeof input !== "string" || !input.trim()) return null
  var forced = input.trim()[0] === "="
  var source = forced ? input.trim().slice(1).trim() : input.trim()
  if (!source) return null
  if (source.length > 1024) return forced ? { error: "Expression is too long" } : null
  var normalized = normalize(source)
  // Avoid treating ordinary menu searches (including app names with digits) as math.
  var names = normalized.replace(/\d(?:\.\d*)?e[+-]?\d+/g, "0").match(/[a-z][a-z0-9_]*/g) || []
  if (!forced && names.some(function(name) { return !owns(constants, name) && !owns(functions, name) }))
    return null
  var hasConstant = names.some(function(name) { return name === "pi" || name === "tau" })
  if (!forced && !hasConstant && !/[+*/^%!()-]/.test(normalized)) return null
  var answer = calculate(source)
  if (answer.error && !forced) return null
  return answer
}

function row(input) {
  var answer = result(input)
  if (!answer) return null
  return {
    itemId: "calculator.result", kind: answer.error ? "calculator-error" : "calculator",
    icon: "=", iconFont: "", appIcon: "", appId: "",
    label: answer.error || answer.text, target: "",
    detail: answer.error ? "Check the expression" : "Enter to copy · radians",
    path: "", childCount: 0, action: "", provider: "", score: -1, section: ""
  }
}

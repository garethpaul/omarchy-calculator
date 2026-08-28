const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const assert = require('node:assert/strict')

const calculator = vm.createContext({})
vm.runInContext(readFileSync(join(__dirname, '../Calculator.js'), 'utf8'), calculator)

const examples = {
  '2 + 2': 4, '2 plus 2': 4, '8 divided by 2': 4, '3 multiplied by 4': 12,
  '2 + 3 * 4': 14, '(2 + 3) * 4': 20, '2^3^2': 512, '2**3': 8,
  '-2^2': -4, '(-2)^2': 4, '2^-2': 0.25, '--2': 2, '3!-2': 4,
  '2pi': 2 * Math.PI, '2(pi + 1)': 2 * (Math.PI + 1), '(2+3)(4+5)': 45,
  '6/2(3)': 9, '3sqrt(9)': 9, 'pi(2)': 2 * Math.PI, '1e3 + 2E-3': 1000.002,
  '.5 + 1.': 1.5, '0.1 + 0.2': 0.30000000000000004,
  '200 * 10%': 20, '200 + 10%': 200.1, '50%': 0.5, '5!': 120, '0!': 1,
  '3!!': 720, 'sin(pi/2)': 1, 'cos(0)': 1, 'tan(pi/4)': 0.9999999999999999,
  'sin(rad(30))': 0.49999999999999994, 'deg(asin(1))': 90, 'deg(acos(0))': 90,
  'atan(1)': Math.PI / 4, 'atan2(1, 0)': Math.PI / 2,
  'sqrt(144)': 12, 'cbrt(-8)': -2, 'pow(2, 10)': 1024, 'exp(1)': Math.E,
  'ln(e)': 1, 'log(1000)': 3, 'log10(100)': 2, 'log2(1024)': 10,
  'min(2, 5)': 2, 'max(2, 5)': 5, 'hypot(3, 4)': 5, 'abs(-7)': 7,
  'ceil(2.1)': 3, 'floor(2.9)': 2, 'round(2.5)': 3, 'round(-2.5)': -2,
  'sinh(0)': 0, 'cosh(0)': 1, 'tanh(0)': 0, 'tau / pi': 2,
  '2 × 3 − 1': 5, '8 ÷ 2': 4, '√(81)': 9, 'π + π': 2 * Math.PI,
  '2 · 3': 6, 'τ/π': 2, 'SIN(PI/2)': 1, '1e-20 * 2': 2e-20
}

for (const [expression, expected] of Object.entries(examples)) {
  test(expression, () => assert.equal(calculator.calculate(expression).value, expected))
}

const invalid = [
  '', '1/0', '0/0', 'sqrt(-1)', 'ln(0)', 'ln(-1)', 'asin(2)', 'acos(-2)',
  '(-1)^0.5', 'tan(pi/2)', '171!', '(-1)!', '2.5!', '10^1000', '1e999',
  '2+', '(2+3', '2+3)', '2 3', '1..2', '1e+', 'sqrt()', 'sqrt(1,2)', 'pow(2)',
  'max(1,2,3)', '2//2', 'min(1,)', '1,2', 'unknown(2)', '0x10',
  'constructor(2)', '__proto__', 'toString(2)', 'Math.random()', '2;3',
  'require("fs")', 'process.exit()', 'globalThis', 'new Function("return 2")()',
  '2[0]', '2 || 3', '`2`', '2=2', '1/* comment */+2', '${2+2}',
  '('.repeat(65) + '2' + ')'.repeat(65), '-'.repeat(65) + '2',
  '2^'.repeat(65) + '2', '1+'.repeat(130) + '1', '1'.repeat(1025)
]

for (const expression of invalid) {
  test(`rejects ${expression.slice(0, 60)}`, () => {
    const result = calculator.calculate(expression)
    assert.equal(typeof result.error, 'string')
    assert.equal(result.value, undefined)
  })
}

test('formats display results without rounding away small values', () => {
  assert.equal(calculator.calculate('0.1 + 0.2').text, '0.3')
  assert.equal(calculator.calculate('-0').text, '0')
  assert.equal(calculator.calculate('1e-20').text, '1e-20')
  assert.equal(calculator.calculate('1/3').text, '0.333333333333333')
})

test('normal menu searches do not turn into calculator errors', () => {
  for (const query of ['firefox', '1password', 'style', 'setup', 'trigger', 'e', '2',
    'wi-fi', 'log', 'sin', '2+', 'sqrt(-1)', 'vs code', 'theme 2', 'log files',
    'toString', 'constructor', '2 + secret', '1'.repeat(1025)]) {
    assert.equal(calculator.result(query), null, query)
  }
})

test('detects mathematical searches, including scientific notation', () => {
  for (const query of ['2+2', '2 plus 2', '1e-3 + 2e-3', 'sin(pi/2)', 'pi', '2pi'])
    assert.equal(typeof calculator.result(query).text, 'string', query)
})

test('explicit calculator searches explain invalid input', () => {
  assert.equal(calculator.result('= 2').text, '2')
  assert.equal(calculator.result('= e').value, Math.E)
  assert.equal(calculator.result('= 1/0').error, 'Cannot divide by zero')
  assert.equal(calculator.result('= 2+').error, 'Incomplete expression')
  assert.equal(calculator.result('= unknown').error, 'Unknown function or constant')
  assert.equal(calculator.result('= ' + '1'.repeat(1025)).error, 'Expression is too long')
  assert.equal(calculator.result('='), null)
})

test('calculator rows are inert data, never shell commands', () => {
  const row = calculator.row('2+2')
  assert.equal(row.label, '4')
  assert.equal(row.kind, 'calculator')
  assert.equal(row.action, '')
  assert.equal(calculator.row('= 1/0').kind, 'calculator-error')
  assert.equal(calculator.row('firefox'), null)
})

test('bounded random input cannot escape the parser or return nonfinite values', () => {
  let seed = 42
  const alphabet = '0123456789e+-*/^%!(), .sqrtpiconstructor[]{};'
  for (let n = 0; n < 5000; n++) {
    let expression = ''
    for (let i = 0; i < n % 80; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      expression += alphabet[seed % alphabet.length]
    }
    const result = calculator.calculate(expression)
    assert.ok(typeof result.error === 'string' || Number.isFinite(result.value))
  }
})

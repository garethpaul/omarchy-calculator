import QtQuick
import QtTest
import "../Calculator.js" as Calculator

TestCase {
  name: "Calculator"

  function test_engine_data() {
    return [
      { tag: "addition", expression: "2+2", expected: "4" },
      { tag: "rounding", expression: "0.1+0.2", expected: "0.3" },
      { tag: "precedence", expression: "-2^2", expected: "-4" },
      { tag: "powers", expression: "2^3^2", expected: "512" },
      { tag: "degrees", expression: "sin(rad(30))", expected: "0.5" },
      { tag: "hypot", expression: "hypot(3,4)", expected: "5" },
      { tag: "log", expression: "log(1000)", expected: "3" },
      { tag: "cube-root", expression: "cbrt(-8)", expected: "-2" },
      { tag: "hyperbolic", expression: "sinh(0)+cosh(0)+tanh(0)", expected: "1" }
    ]
  }

  function test_engine(data) {
    compare(Calculator.calculate(data.expression).text, data.expected)
  }

  function test_search() {
    compare(Calculator.row("firefox"), null)
    compare(Calculator.row("2+2").label, "4")
    compare(Calculator.row("= 1/0").kind, "calculator-error")
  }

  function test_list_model() {
    rows.append(Calculator.row("2+2"))
    compare(rows.get(0).label, "4")
    rows.clear()
    rows.append(Calculator.row("= 1/0"))
    compare(rows.get(0).kind, "calculator-error")
  }

  ListModel { id: rows }
}

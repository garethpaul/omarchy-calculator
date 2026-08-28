# Omarchy Calculator

Type `2+2` in the Omarchy menu. See `4`. Press Enter to copy it.

A native Omarchy 4 shell plugin that adds arithmetic and scientific calculations
to the existing menu, including its Apps submenu. Your shortcuts, theme, menu
extensions, application search, and menu bar button stay in place.

## Install

Requires Omarchy **4.0.1** with the Quickshell menu and `wl-copy` from
`wl-clipboard`. This is not a Walker or Elephant plugin.

```sh
omarchy plugin add https://github.com/garethpaul/omarchy-calculator.git --enable
```

Open the menu with **Super/Command+Space**, or Apps with
**Super/Command+Alt+Space**, and type an expression. Click the result or press
Enter to copy it. No configuration or extra keybinding is needed.

```sh
omarchy plugin update garethpaul.calculator
omarchy plugin disable garethpaul.calculator
omarchy plugin remove garethpaul.calculator
```

Disabling restores the built-in menu. Only one clone of `omarchy.menu` can be
active at a time; enabling this plugin replaces any other active menu clone.

## Expressions

| Input | Result |
| --- | --- |
| `2 + 2` or `2 plus 2` | `4` |
| `(12 + 8) / 5` | `4` |
| `2^10` or `2**10` | `1024` |
| `sqrt(144)` | `12` |
| `2pi` | `6.28318530717959` |
| `sin(pi/2)` | `1` |
| `sin(rad(30))` | `0.5` |
| `log(1000)` | `3` |
| `ln(e)` | `1` |
| `5!` | `120` |
| `200 * 10%` | `20` |
| `1e3 + 2e-3` | `1000.002` |

Arithmetic uses conventional precedence: `-2^2` is `-4`, and `2^3^2` is `512`.
Implicit multiplication has the same precedence as explicit multiplication,
so `6/2(3)` is `9`. `%` divides its operand by 100: `200 + 10%` is `200.1`,
not a ten-percent increase. Use `200 * 1.10` for that.

Trig functions take **radians**. `rad(x)` converts degrees to radians; `deg(x)`
converts radians to degrees. `log` and `log10` are base 10; `ln` is natural log.
Function calls need parentheses. Constants are `pi`, `tau`, and `e`.

Supported functions:

```text
abs ceil floor round sqrt cbrt exp ln log log10 log2
sin cos tan asin acos atan sinh cosh tanh rad deg
pow(x,y) atan2(y,x) min(x,y) max(x,y) hypot(x,y)
```

`round` uses nearest-integer rounding, with ties toward positive infinity.
Factorials accept integers from 0 through 170. Unicode `π`, `τ`, `√(x)`, `×`,
`÷`, `·`, and `−` work, as do `plus`, `minus`, `times`, `multiplied by`, and
`divided by`.

Prefix a query with `=` to force calculator mode and see errors, such as
`= 1/0`. Without the prefix, invalid or incomplete expressions leave ordinary
menu search alone. Dmenu selection and text-input prompts are unchanged.

## Limits and privacy

The calculator uses real, double-precision floating-point numbers and displays
15 significant digits. It is not arbitrary-precision arithmetic; large integers
can lose precision and extremely small values can underflow to zero. It does
not provide currency, unit conversions, variables, or complex numbers.

Expressions are parsed locally with bounded input, token counts, and nesting.
The calculator does not evaluate JavaScript, execute expressions as shell
commands, contact a server, keep calculation history, or require credentials.
Only the formatted number is passed to `wl-copy`, as a separate argument.
Your system clipboard manager may retain copied results.

Like other Omarchy plugins, it runs unsandboxed inside the shell. The inherited
menu still launches applications and runs your configured menu actions.

## Development

No package install or build step is needed. Run the tests with Node.js 22+:

```sh
node --test tests/*.test.cjs
```

To exercise the engine in Qt's JavaScript runtime as well:

```sh
env QT_QPA_PLATFORM=offscreen /usr/lib/qt6/bin/qmltestrunner -input tests
omarchy plugin validate .
```

On an Omarchy desktop with this plugin enabled, `python3 tests/desktop.py`
checks Super+Space, the Apps route, scientific results, Enter-to-copy, and dmenu
selection/input. It takes keyboard focus and replaces the clipboard; do not
type or switch windows while it runs. Custom shortcut bindings require adapting
that test. Screenshots and desktop state are not collected by the test.

The plugin uses Omarchy's `clonedFrom` mechanism because this menu version has
no search-provider extension point. The menu files are derived from
[Omarchy at 64e20f8](https://github.com/basecamp/omarchy/commit/64e20f8).
`MenuModel.js` and `BarWidget.qml` are unchanged. `Menu.qml` adds a calculator
row, clipboard handling, and explicit plain-text rendering. `Calculator.js`
contains the standalone parser and row adapter.

This is a maintained menu clone, not an automatic patch to the installed menu.
Upstream menu changes must be reviewed and merged here. Other Omarchy versions
are unverified; disable the plugin if a shell update changes its interfaces.
The original MIT license is retained in [LICENSE](LICENSE).

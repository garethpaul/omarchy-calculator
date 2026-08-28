"""Opt-in smoke test. Uses the live menu and replaces the clipboard contents."""

import json
import subprocess
import tempfile
import time
from pathlib import Path


def run(*args):
    if args[0] == "wl-copy":
        # Its clipboard-owning child outlives the command; do not give it pipes.
        subprocess.run(args, check=True, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=10)
        return b""
    return subprocess.run(args, check=True, capture_output=True, timeout=10).stdout


def menu_call(method, argument):
    result = run("omarchy-shell", "shell", "call", "omarchy.menu", method, argument)
    assert result.strip() == b"ok", "Menu did not accept the test action"


def wait_for(predicate, message):
    for _ in range(40):
        if predicate():
            return
        time.sleep(0.05)
    raise AssertionError(message)


def clipboard_is(expected):
    return run("wl-paste", "--no-newline") == expected.encode()


def menu_is_visible():
    monitors = json.loads(run("hyprctl", "layers", "-j"))
    return any(layer["namespace"] == "omarchy-menu"
               for monitor in monitors.values()
               for layers in monitor["levels"].values() for layer in layers)


def copy_expression(expression, expected, route="root", shortcut=None):
    run("omarchy-menu", "close")
    run("wl-copy", "--", "calculator-test-pending")
    if shortcut == "root":
        run("wtype", "-M", "logo", "-k", "space", "-m", "logo")
    else:
        run("omarchy-menu", "summon", route)
    wait_for(menu_is_visible, "Menu did not open; check the shortcut bindings")
    # Allow the layer surface to receive keyboard focus before typing.
    time.sleep(0.3)
    run("wtype", "--", expression)
    time.sleep(0.15)
    run("wtype", "-k", "Return")
    wait_for(lambda: clipboard_is(expected), "Clipboard did not match the expected result")
    wait_for(lambda: not menu_is_visible(), "Menu did not close after copying")
    print(f"PASS: {shortcut or route}: {expression} -> {expected}")


def dmenu_selection(directory, mode):
    selection = directory / "selection"
    done = directory / "done"
    selection.unlink(missing_ok=True)
    done.unlink(missing_ok=True)
    run("omarchy-shell", "shell", "summon", "omarchy.menu", json.dumps({
        "mode": mode, "options": ["2+2", "other"],
        "selectionFile": str(selection), "doneFile": str(done),
    }))
    wait_for(menu_is_visible, "Dmenu did not open")
    time.sleep(0.2)
    menu_call("setFilter", "2+2")
    run("wtype", "-k", "Return")
    wait_for(done.exists, "Dmenu did not finish")
    assert selection.read_text().strip() == "2+2", "Dmenu changed the selection into a calculation"
    print(f"PASS: dmenu {mode} returns the original input")


def main():
    plugins = json.loads(run("omarchy", "plugin", "list", "--json"))
    assert any(p["id"] == "garethpaul.calculator" and p["enabled"] for p in plugins), \
        "Install and enable the calculator plugin before running this test"

    try:
        copy_expression("2+2", "4", shortcut="root")
        copy_expression("sqrt(144)", "12", route="apps")
        copy_expression("sin(rad(30))", "0.5", route="style")
        copy_expression("2^3^2", "512", route="trigger")
        copy_expression("-2^2", "-4", route="setup")
        copy_expression("0.1+0.2", "0.3")
        run("omarchy-menu", "summon")
        run("wl-copy", "--", "calculator-test-pending")
        menu_call("setFilter", "= 1/0")
        run("wtype", "-k", "Return")
        time.sleep(0.2)
        assert clipboard_is("calculator-test-pending"), "Error row changed the clipboard"
        print("PASS: an error row cannot be copied")
        with tempfile.TemporaryDirectory(prefix="calculator-test-") as directory:
            for mode in ["select", "input"]:
                dmenu_selection(Path(directory), mode)
    finally:
        run("omarchy-menu", "close")


if __name__ == "__main__":
    main()

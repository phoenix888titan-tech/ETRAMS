// Temporary test harness: settings.html + error-capture hook that auto-clicks the Grid tab.
// Used only for headless-Chrome reproduction; safe to delete.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'settings.html'), 'utf8');

const hook = [
  '<script>',
  '  window.__errs = [];',
  '  function pushErr(m) {',
  '    window.__errs.push(String(m));',
  '    var el = document.getElementById("errlog");',
  '    if (!el) { el = document.createElement("pre"); el.id = "errlog"; (document.body || document.documentElement).appendChild(el); }',
  '    el.textContent = window.__errs.join("\\n---\\n");',
  '  }',
  '  window.addEventListener("error", function (e) { pushErr("onerror: " + e.message + " @ " + (e.filename || "") + ":" + (e.lineno || "")); });',
  '  window.addEventListener("unhandledrejection", function (e) { pushErr("unhandledrejection: " + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)); });',
  '  var origErr = console.error;',
  '  console.error = function () {',
  '    var parts = [];',
  '    for (var i = 0; i < arguments.length; i++) { var a = arguments[i]; parts.push((a && (a.stack || a.message)) || String(a)); }',
  '    pushErr("console.error: " + parts.join(" "));',
  '    origErr.apply(console, arguments);',
  '  };',
  '  window.addEventListener("load", function () {',
  '    setTimeout(function () {',
  '      pushErr("no-error-marker");',
  '      var btns = Array.prototype.slice.call(document.querySelectorAll(".tab-btn"));',
  '      var grid = btns.find(function (b) { return b.textContent.trim() === "Grid"; });',
  '      if (grid) { grid.click(); pushErr("clicked Grid tab"); } else { pushErr("Grid tab button not found"); }',
  '      setTimeout(function () { pushErr("dump-ready"); }, 2000);',
  '    }, 2500);',
  '  });',
  '</' + 'script>'
].join('\n');

fs.writeFileSync(
  path.join(__dirname, '..', 'public', '_test-settings.html'),
  src.replace('</head>', hook + '\n</head>')
);
console.log('test page written');

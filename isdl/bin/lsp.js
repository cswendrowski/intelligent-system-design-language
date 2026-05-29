#!/usr/bin/env node

// Launches the ISDL language server (LSP) so any LSP-capable editor (Neovim,
// Emacs, Sublime, etc.) can get diagnostics, completion and validation for
// .isdl files. The transport (--stdio / --node-ipc / --socket) is detected
// automatically from argv by vscode-languageserver; editors typically pass
// --stdio. Importing the bundled server module starts it immediately.
import '../out/language/main.cjs';

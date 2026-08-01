# Tree-sitter LambdaMOO

[![npm version](https://img.shields.io/npm/v/tree-sitter-lambdamoo.svg)](https://www.npmjs.com/package/tree-sitter-lambdamoo)
[![crates.io](https://img.shields.io/crates/v/tree-sitter-lambdamoo.svg)](https://crates.io/crates/tree-sitter-lambdamoo)

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar and parser for the **LambdaMOO** (MOO) scripting language.

This project enables fast, incremental parsing and syntax analysis of MOO code, suitable for syntax highlighting, code navigation, language servers, and editor integration (e.g., Neovim, Helix, Zed, VS Code).

---

## Installation

`tree-sitter-lambdamoo` is published on [npmjs](https://www.npmjs.com/package/tree-sitter-lambdamoo) and [crates.io](https://crates.io/crates/tree-sitter-lambdamoo), so you can include it directly in your project dependencies without referencing local directory paths.

### Node.js (npm)

```bash
npm install tree-sitter-lambdamoo
```

### Rust (Cargo)

```bash
cargo add tree-sitter-lambdamoo
```

### Go

```bash
go get github.com/kruton/tree-sitter-lambdamoo
```

---

## Features & Grammar Coverage

The grammar ([grammar.js](./grammar.js)) supports standard LambdaMOO syntax.

## Repository Structure

Key files:
- [grammar.js](./grammar.js): Edit this file to add or modify grammar rules.
- [queries/highlights.scm](./queries/highlights.scm): Queries mapping AST nodes to syntax highlight capture groups.
- [bindings/rust/lib.rs](./bindings/rust/lib.rs): Rust API integration.
- [bindings/node/index.js](./bindings/node/index.js): Node.js native module loader.
- [bindings/go/binding.go](./bindings/go/binding.go): Go API integration.

---

## Prerequisites

To build and contribute to this repository, ensure you have the following installed:

- **Node.js** and `npm`
- **Rust Toolchain** (`cargo`, `rustc`) for building and testing Rust bindings
- **C Compiler** (`gcc`, `clang`, or MSVC) for building native parser binaries
- **Tree-sitter CLI**: Can be run via `npx tree-sitter` or installed globally:
  ```bash
  npm install -g tree-sitter-cli
  # or via Cargo:
  cargo install tree-sitter-cli
  ```

---

## Building and Developing

### 1. Install Node Dependencies

```bash
npm install
```

### 2. Generate the Parser

When modifying [grammar.js](./grammar.js), you must re-generate the C parser files in [src/](./src):

```bash
npm run build
# or directly with tree-sitter CLI:
npx tree-sitter generate
```

This updates `src/parser.c`, `src/grammar.json`, and `src/node-types.json`.

### 3. Running Tests

#### Rust Tests
To test the Rust binding and verify that `parser.c` compiles cleanly with C compilers:

```bash
cargo test
```

#### Go Tests
To test the Go bindings:

```bash
go test ./bindings/go/...
```

#### Tree-sitter Corpus Tests
To run Tree-sitter parser tests:

```bash
npm test
# or:
npx tree-sitter test
```

### 4. Parsing MOO Code Interactively

You can test parsing a MOO file or snippet using the CLI:

```bash
npx tree-sitter parse path/to/script.moo
```

---

## Usage Examples

### Rust Integration

Add `tree-sitter-lambdamoo` and `tree-sitter` to your `Cargo.toml`:

```toml
[dependencies]
tree-sitter = "0.26"
tree-sitter-lambdamoo = "0.1"
```

In your Rust code:

```rust
use tree_sitter::Parser;

fn main() {
    let mut parser = Parser::new();
    let language = tree_sitter_lambdamoo::LANGUAGE;
    parser.set_language(&language.into()).expect("Error loading LambdaMOO grammar");

    let source_code = r#"
        if (player.wizard)
            player:tell("Hello, wizard!");
        endif
    "#;

    let tree = parser.parse(source_code, None).unwrap();
    println!("{}", tree.root_node().to_sexp());
}
```

### Node.js Integration

Install the package via npm:

```bash
npm install tree-sitter-lambdamoo
```

In JavaScript:

```javascript
const Parser = require('tree-sitter');
const LambdaMOO = require('tree-sitter-lambdamoo');

const parser = new Parser();
parser.setLanguage(LambdaMOO);

const sourceCode = 'return player:location();';
const tree = parser.parse(sourceCode);
console.log(tree.root_node.toString());
```

### Go Integration

Install the packages:

```bash
go get github.com/tree-sitter/go-tree-sitter
go get github.com/kruton/tree-sitter-lambdamoo
```

In Go:

```go
package main

import (
	"fmt"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_lambdamoo "github.com/kruton/tree-sitter-lambdamoo/bindings/go"
)

func main() {
	parser := tree_sitter.NewParser()
	defer parser.Close()

	language := tree_sitter.NewLanguage(tree_sitter_lambdamoo.Language())
	parser.SetLanguage(language)

	sourceCode := []byte("return player:location();")
	tree := parser.Parse(sourceCode, nil)
	defer tree.Close()

	fmt.Println(tree.RootNode().ToSexp())
}
```

---

## Contributing

1. **Modify Grammar**: Make updates to rules in [grammar.js](./grammar.js).
2. **Re-generate Parser**: Run `npx tree-sitter generate` to refresh generated files in `src/`.
3. **Add Tests**: Add test cases to `test/corpus/` following the Tree-sitter test file format.
4. **Verify Changes**: Run `cargo test` and `npm test` to ensure all tests pass cleanly.

---

## License

This project is dual-licensed / distributed under the MIT License

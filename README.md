# Tree-sitter LambdaMOO (`tree-sitter-lambdamoo`)

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar and parser for the **LambdaMOO** (MOO) scripting language.

This project enables fast, incremental parsing and syntax analysis of MOO code, suitable for syntax highlighting, code navigation, language servers, and editor integration (e.g., Neovim, Helix, Zed, VS Code).

---

## Features & Grammar Coverage

The grammar ([grammar.js](./grammar.js)) supports standard LambdaMOO syntax.

## Repository Structure

Key files:
- [grammar.js](./grammar.js): Edit this file to add or modify grammar rules.
- [highlights.scm](./highlights.scm): Queries mapping AST nodes to syntax highlight capture groups.
- [bindings/rust/lib.rs](./bindings/rust/lib.rs): Rust API integration.
- [bindings/node/index.js](./bindings/node/index.js): Node.js native module loader.

---

## Prerequisites

To build and contribute to this repository, ensure you have the following installed:

- **Node.js** (v18+ recommended) and `npm`
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
tree-sitter-lambdamoo = { path = "path/to/moo-tree-sitter" }
```

In your Rust code:

```rust
use tree_sitter::Parser;

fn main() {
    let mut parser = Parser::new();
    let language = tree_sitter_lambdamoo::language();
    parser.set_language(&language).expect("Error loading LambdaMOO grammar");

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

```javascript
const Parser = require('tree-sitter');
const LambdaMOO = require('tree-sitter-lambdamoo');

const parser = new Parser();
parser.setLanguage(LambdaMOO);

const sourceCode = 'return player:location();';
const tree = parser.parse(sourceCode);
console.log(tree.root_node.toString());
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

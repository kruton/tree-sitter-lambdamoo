//! This crate provides LambdaMOO language support for the [tree-sitter][] parsing library.
//!
//! Typically, you will use the [LANGUAGE][] constant to add this language to a
//! tree-sitter [Parser][], and then use the parser to parse some code:
//!
//! ```
//! let code = r#"
//! if (player.location == this.location)
//!   player:tell("The room vibrates with power!");
//! endif
//! "#;
//! let mut parser = tree_sitter::Parser::new();
//! let language = tree_sitter_lambdamoo::LANGUAGE;
//! parser
//!     .set_language(&language.into())
//!     .expect("Error loading LambdaMOO parser");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [Parser]: https://docs.rs/tree-sitter/*/tree_sitter/struct.Parser.html
//! [tree-sitter]: https://tree-sitter.github.io/

use tree_sitter_language::LanguageFn;

unsafe extern "C" {
    fn tree_sitter_lambdamoo() -> *const ();
}

/// Get the tree-sitter [`LanguageFn`][LanguageFn] for this grammar.
///
/// [LanguageFn]: https://docs.rs/tree-sitter-language/*/tree_sitter_language/struct.LanguageFn.html
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_lambdamoo) };

/// The content of the [`node-types.json`][] file for this grammar.
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers#static-node-types
pub const NODE_TYPES: &'static str = include_str!("../../src/node-types.json");

// Uncomment these to include any queries that this grammar contains

pub const HIGHLIGHTS_QUERY: &'static str = include_str!("../../queries/highlights.scm");
pub const FOLDS_QUERY: &'static str = include_str!("../../queries/folds.scm");
pub const INDENTS_QUERY: &'static str = include_str!("../../queries/indents.scm");
pub const LOCALS_QUERY: &'static str = include_str!("../../queries/locals.scm");
pub const TAGS_QUERY: &'static str = include_str!("../../queries/tags.scm");
pub const ERRORS_QUERY: &'static str = include_str!("../../queries/errors.scm");

#[cfg(test)]
mod tests {
    #[test]
    fn test_can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading LambdaMOO parser");
    }

    #[test]
    fn test_errors_query_captures_invalid_identifier_only() {
        use tree_sitter::StreamingIterator;

        let language = super::LANGUAGE.into();
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&language).unwrap();
        let source = "notify(if); result = E_NONE;";
        let tree = parser.parse(source, None).unwrap();

        assert!(!tree.root_node().has_error());

        let query = tree_sitter::Query::new(&language, super::ERRORS_QUERY).unwrap();
        let mut cursor = tree_sitter::QueryCursor::new();
        let mut captures = cursor.captures(&query, tree.root_node(), source.as_bytes());
        let capture_names = query.capture_names();
        let mut captured = Vec::new();
        while let Some((query_match, capture_index)) = captures.next() {
            captured.push(capture_names[query_match.captures[*capture_index].index as usize]);
        }

        assert_eq!(captured, ["invalid_identifier"]);
    }
}

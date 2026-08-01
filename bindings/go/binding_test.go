package tree_sitter_lambdamoo_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_lambdamoo "github.com/kruton/tree-sitter-lambdamoo/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_lambdamoo.Language())
	if language == nil {
		t.Errorf("Error loading LambdaMOO grammar")
	}
}

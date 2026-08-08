; Scopes
[
  (source_file)
  (if_statement)
  (for_statement)
  (while_statement)
  (fork_statement)
  (try_statement)
] @local.scope

; Variable Definitions
(assignment
  (identifier) @local.definition)

(for_statement
  (identifier) @local.definition)

; Variable References
(identifier) @local.reference

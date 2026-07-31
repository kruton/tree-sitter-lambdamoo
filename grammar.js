// Copyright (c) 2026 Kenny Root
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

module.exports = grammar({
  name: 'lambdamoo',

  extras: $ => [
    /\s/, // skip whitespace
    $.comment,
  ],

  rules: {
    // --- Top-level ---
    source_file: $ => repeat($.statement),

    // --- Statements ---
    statement: $ => choice(
      $.expression_statement,
      $.if_statement,
      $.for_statement,
      $.while_statement,
      $.fork_statement,
      $.break_statement,
      $.continue_statement,
      $.return_statement,
      $.try_statement,
      ';', // empty statement
    ),

    expression_statement: $ => seq($.expression, ';'),

    if_statement: $ => seq(
      'if', '(', $.expression, ')',
      repeat($.statement),
      repeat($.elseif_clause),
      optional($.else_clause),
      'endif',
    ),

    elseif_clause: $ => seq(
      'elseif', '(', $.expression, ')',
      repeat($.statement),
    ),

    else_clause: $ => seq(
      'else',
      repeat($.statement),
    ),

    for_statement: $ => choice(
      seq('for', $.identifier, 'in', '(', $.expression, ')', repeat($.statement), 'endfor'),
      seq('for', $.identifier, 'in', '[', $.expression, '..', $.expression, ']', repeat($.statement), 'endfor'),
    ),

    while_statement: $ => seq(
      'while', optional($.identifier), '(', $.expression, ')',
      repeat($.statement),
      'endwhile',
    ),

    fork_statement: $ => seq(
      'fork', optional($.identifier), '(', $.expression, ')',
      repeat($.statement),
      'endfork',
    ),

    break_statement: $ => seq('break', optional($.identifier), ';'),
    continue_statement: $ => seq('continue', optional($.identifier), ';'),
    return_statement: $ => seq('return', optional($.expression), ';'),

    try_statement: $ => choice(
      seq('try', repeat($.statement), repeat1($.except_clause), 'endtry'),
      seq('try', repeat($.statement), 'finally', repeat($.statement), 'endtry'),
    ),

    except_clause: $ => seq(
      'except', optional($.identifier), '(', $.codes, ')',
      repeat($.statement),
    ),

    codes: $ => choice(
      'ANY',
      $.arg_list,
    ),

    // --- Expressions (Precedence ordered in choice) ---
    expression: $ => choice(
      $.assignment,
      $.ternary_expression,
      $.binary_expression,
      $.unary_expression,
      $.range_access,
      $.index_access,
      $.verb_call,
      $.prop_access,
      $.call_expression,
      $.catch_expression,
      $.list_literal,
      $.identifier,
      $.number,
      $.string,
      $.object,
      $.error,
      '$', // length
      seq('(', $.expression, ')'),
    ),

    // Level 1: Assignment (Right associative)
    assignment: $ => prec.right(1, seq($.expression, '=', $.expression)),

    // Level 1: Ternary (Right associative)
    ternary_expression: $ => prec.right(1, seq($.expression, '?', $.expression, '|', $.expression)),

    // Levels 2-12: Binary Operators
    binary_expression: $ => {
      const table = [
        [prec.left, 2, '||'],
        [prec.left, 3, '&&'],
        [prec.left, 4, '|.'],
        [prec.left, 5, '^.'],
        [prec.left, 6, '&.'],
        [prec.left, 7, choice('==', '!=')],
        [prec.left, 8, choice('<', '<=', '>', '>=', 'in')],
        [prec.left, 9, choice('<<', '>>', '>>>')],
        [prec.left, 10, choice('+', '-')],
        [prec.left, 11, choice('*', '/', '%')],
        [prec.right, 12, '^'],
      ];

      return choice(...table.map(([assoc, p, op]) =>
        assoc(p, seq($.expression, op, $.expression)),
      ));
    },

    // Level 13: Unary Operators
    unary_expression: $ => prec(13, choice(
      seq('!', $.expression),
      seq('~', $.expression),
      seq('-', $.expression),
    )),

    // Level 14: Postfix Operations (Highest precedence)
    range_access: $ => prec(14, seq($.expression, '[', $.expression, '..', $.expression, ']')),
    index_access: $ => prec(14, seq($.expression, '[', $.expression, ']')),

    verb_call: $ => prec(14, choice(
      seq($.expression, ':', $.identifier, '(', optional($.arg_list), ')'),
      seq($.expression, ':', '(', $.expression, ')', '(', optional($.arg_list), ')'),
      seq('$', $.identifier, '(', optional($.arg_list), ')'),
    )),

    prop_access: $ => prec(14, choice(
      seq('$', $.identifier),
      seq($.expression, '.', $.identifier),
      seq($.expression, '.', '(', $.expression, ')'),
    )),

    call_expression: $ => prec(14, seq($.identifier, '(', optional($.arg_list), ')')),

    // --- Helper rules for expressions ---
    arg_list: $ => seq(
      $.arg_item,
      repeat(seq(',', $.arg_item)),
    ),

    arg_item: $ => choice(
      $.expression,
      seq('@', $.expression),
      seq('?', $.identifier),
      seq('?', $.identifier, '=', $.expression),
    ),

    list_literal: $ => seq('{', optional($.arg_list), '}'),

    catch_expression: $ => seq('`', $.expression, '!', $.codes, optional(seq('=>', $.expression)), '\''),

    // --- Primitives / Literals ---
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    number: $ => /[0-9]+(\.[0-9]+)?/,
    string: $ => /"([^"\\]|\\.)*"/,
    object: $ => /#-?[0-9]+/,
    error: $ => choice('E_NONE', 'E_TYPE', 'E_DIV', 'E_PERM', 'E_PROPNF', 'E_VERBNF', 'E_VARNF', 'E_INVIND', 'E_RECMOVE', 'E_MAXREC', 'E_RANGE', 'E_ARGS', 'E_NACC', 'E_INVARG', 'E_QUOTA', 'E_FLOAT'),

    // --- Comments ---
    comment: $ => seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'),
  },
});

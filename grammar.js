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

const EXPRESSION_RULES = [
  'scattering_assignment',
  'assignment',
  'ternary_expression',
  'binary_expression',
  'unary_expression',
  'range_access',
  'index_access',
  'verb_call',
  'prop_access',
  'call_expression',
  'catch_expression',
  'list_literal',
];

// Wrapping the hidden rule in `seq` prevents Tree-sitter from optimizing away
// the public alias when the hidden rule has a simple production.
const asPublic = (rule, publicRule) => alias(seq(rule), publicRule);

function makeExpression($, prefix = '', includeLength = false) {
  const expression = $[`${prefix}expression`];
  const expressions = EXPRESSION_RULES.map(name => {
    const rule = $[`${prefix}${name}`];
    return prefix ? asPublic(rule, $[name]) : rule;
  });

  return choice(
    ...expressions,
    $.identifier,
    $.number,
    $.string,
    $.object,
    $.error,
    ...(includeLength ? [$.length] : []),
    seq('(', expression, ')'),
  );
}

function makeBinaryExpression(expr) {
  // Precedence order matching LambdaMOO parser.y (lines 106-117):
  // Level 1 (loosest precedence):  || &&
  // Level 2:                       == != < <= > >= in
  // Level 3:                       |.
  // Level 4:                       ^.
  // Level 5:                       &.
  // Level 6:                       << >> >>>
  // Level 7:                       + -
  // Level 8:                       * / %
  // Level 9 (tightest precedence): ^ (right associative)
  const table = [
    [prec.left, 1, choice('||', '&&')],
    [prec.left, 2, choice('==', '!=', '<', '<=', '>', '>=')],
    [prec.left, 2, 'in'],
    [prec.left, 3, '|.'],
    [prec.left, 4, '^.'],
    [prec.left, 5, '&.'],
    [prec.left, 6, choice('<<', '>>', '>>>')],
    [prec.left, 7, choice('+', '-')],
    [prec.left, 8, choice('*', '/', '%')],
    [prec.right, 9, '^'],
  ];

  return choice(...table.map(([assoc, p, op]) =>
    assoc(p, seq(expr, op, expr)),
  ));
}

const makeAssignment = expr => prec.right(1, seq(expr, '=', expr));
const makeScatteringAssignment = ($, expr, prefix = '') => prec.dynamic(1,
  prec.right(2, seq('{', $[`${prefix}scatter_list`], '}', '=', expr)),
);

const makeTernaryExpression = expr => prec.right(2, seq(expr, '?', expr, '|', expr));
const makeUnaryExpression = expr => prec(12, choice(
  seq('!', expr),
  seq('~', expr),
  seq('-', expr),
));
const makeRangeAccess = (expr, subscript) => prec(13, seq(expr, '[', subscript, '..', subscript, ']'));
const makeIndexAccess = (expr, subscript) => prec(13, seq(expr, '[', subscript, ']'));
const makeVerbCall = ($, expr, argList) => prec(13, choice(
  seq(expr, ':', $.identifier, '(', optional(argList), ')'),
  seq(expr, ':', '(', expr, ')', '(', optional(argList), ')'),
  seq('$', $.identifier, '(', optional(argList), ')'),
));
const makePropAccess = ($, expr) => prec(13, choice(
  seq('$', $.identifier),
  seq(expr, '.', $.identifier),
  seq(expr, '.', '(', expr, ')'),
));
const makeCallExpression = ($, argList) => prec(13, seq($.identifier, '(', optional(argList), ')'));
const makeArgList = argItem => seq(argItem, repeat(seq(',', argItem)));
const makeArgItem = ($, expr) => choice(
  expr,
  seq('@', expr),
);

const makeScatterList = ($, expr) => seq(makeScatterItem($, expr), repeat(seq(',', makeScatterItem($, expr))));
const makeScatterItem = ($, expr) => choice(
  $.identifier,
  seq('@', $.identifier),
  seq('?', $.identifier),
  seq('?', $.identifier, '=', expr),
);

const makeListLiteral = argList => seq('{', optional(argList), '}');
const makeCatchExpression = (expr, codes) => seq('`', expr, '!', codes, optional(seq('=>', expr)), '\'');

module.exports = grammar({
  name: 'lambdamoo',

  conflicts: $ => [
    [$.expression, $.scatter_list],
    [$._subscript_expression, $._subscript_scatter_list],
  ],

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

    codes: $ => choice('ANY', $.arg_list),
    _subscript_codes: $ => choice('ANY', asPublic($._subscript_arg_list, $.arg_list)),

    // --- Expressions (Precedence ordered in choice) ---
    expression: $ => makeExpression($),

    length: $ => '$',

    _subscript_expression: $ => makeExpression($, '_subscript_', true),

    // Level 1: Assignment (Right associative)
    assignment: $ => makeAssignment($.expression),
    _subscript_assignment: $ => makeAssignment($._subscript_expression),

    scattering_assignment: $ => makeScatteringAssignment($, $.expression, ''),
    _subscript_scattering_assignment: $ => prec.dynamic(1, prec.right(2, seq(
      '{', asPublic($._subscript_scatter_list, $.scatter_list), '}', '=', $._subscript_expression,
    ))),

    scatter_list: $ => makeScatterList($, $.expression),
    _subscript_scatter_list: $ => makeScatterList($, $._subscript_expression),

    scatter_item: $ => makeScatterItem($, $.expression),
    _subscript_scatter_item: $ => makeScatterItem($, $._subscript_expression),

    // Level 1: Ternary (Right associative)
    ternary_expression: $ => makeTernaryExpression($.expression),
    _subscript_ternary_expression: $ => makeTernaryExpression($._subscript_expression),

    // Levels 2-12: Binary Operators
    binary_expression: $ => makeBinaryExpression($.expression),
    _subscript_binary_expression: $ => makeBinaryExpression($._subscript_expression),

    // Level 13: Unary Operators
    unary_expression: $ => makeUnaryExpression($.expression),
    _subscript_unary_expression: $ => makeUnaryExpression($._subscript_expression),

    // Level 14: Postfix Operations (Highest precedence)
    range_access: $ => makeRangeAccess($.expression, $._subscript_expression),
    _subscript_range_access: $ => makeRangeAccess($._subscript_expression, $._subscript_expression),

    index_access: $ => makeIndexAccess($.expression, $._subscript_expression),
    _subscript_index_access: $ => makeIndexAccess($._subscript_expression, $._subscript_expression),

    verb_call: $ => makeVerbCall($, $.expression, $.arg_list),
    _subscript_verb_call: $ => makeVerbCall($, $._subscript_expression, asPublic($._subscript_arg_list, $.arg_list)),

    prop_access: $ => makePropAccess($, $.expression),
    _subscript_prop_access: $ => makePropAccess($, $._subscript_expression),

    call_expression: $ => makeCallExpression($, $.arg_list),
    _subscript_call_expression: $ => makeCallExpression($, asPublic($._subscript_arg_list, $.arg_list)),

    // --- Helper rules for expressions ---
    arg_list: $ => makeArgList($.arg_item),
    _subscript_arg_list: $ => makeArgList(asPublic($._subscript_arg_item, $.arg_item)),

    arg_item: $ => makeArgItem($, $.expression),
    _subscript_arg_item: $ => makeArgItem($, $._subscript_expression),

    list_literal: $ => makeListLiteral($.arg_list),
    _subscript_list_literal: $ => makeListLiteral(asPublic($._subscript_arg_list, $.arg_list)),

    catch_expression: $ => makeCatchExpression($.expression, $.codes),
    _subscript_catch_expression: $ => makeCatchExpression(
      $._subscript_expression,
      asPublic($._subscript_codes, $.codes),
    ),

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

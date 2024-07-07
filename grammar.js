/**
 * @file Squirrel grammar for tree-sitter
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @license MIT
 * @see {@link http://squirrel-lang.org|official website}
 * @see {@link https://github.com/albertodemichelis/squirrel|official repository}
 * @see {@link http://squirrel-lang.org/squirreldoc/reference/index.html|official spec}
 */

// deno-lint-ignore-file ban-ts-comment
/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// http://squirrel-lang.org/squirreldoc/reference/language/expressions.html#operators-precedence
const PREC = {
  PAREN: -1,
  ASSIGN: 1,
  TERNARY: 2,
  LOGICAL_OR: 3,
  LOGICAL_AND: 4,
  IN: 4,
  INCLUSIVE_OR: 5,
  EXCLUSIVE_OR: 6,
  BITWISE_AND: 7,
  EQUALITY: 8,
  COMPARISON: 9,
  INSTANCEOF: 9,
  SHIFT: 10,
  ADDITIVE: 11,
  MULTIPLICATIVE: 12,
  UNARY: 13,
  CALL: 14,
  MEMBER: 15,
};

/**
 * Creates a rule to match zero or more of the rules optionally separated by a comma
 *
 * @param {Rule} rule
 *
 * @return {SeqRule}
 *
 */
function optionalCommaSep(rule) {
  return sep1(rule, optional(','));
}

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @return {SeqRule}
 *
 */
function commaSep1(rule) {
  return sep1(rule, ',');
}

/**
  * Creates a rule to match zero or more of the rules separated by a comma
  * @param {Rule} rule
  * @return {ChoiceRule}
  */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
* Creates a rule to match one or more of the rules separated by the separator
*
* @param {Rule} rule
* @param {string|Rule} separator - The separator to use.
*
* @return {SeqRule}
*
*/
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

module.exports = grammar({
  name: 'squirrel',

  externals: $ => [
    $.verbatim_string,
  ],

  extras: $ => [
    $.comment,
    /\s/,
  ],

  inline: $ => [
    $.expression_statement,
    $._statements,
    $._statement,
  ],

  supertypes: $ => [
    $.expression,
    $.primary_expression,
    // $._statement,
  ],

  word: $ => $.identifier,

  rules: {
    script: $ => optional($._statements),

    _statements: $ => repeat1($._statement),

    _statement: $ => choice(
      $.block,
      $.if_statement,
      $.while_statement,
      $.do_while_statement,
      $.switch_statement,
      $.for_statement,
      $.foreach_statement,
      $.break,
      $.continue,
      $.return,
      $.yield,
      $.local_declaration,
      $.var_statement,
      $.function_declaration,
      $.class_declaration,
      $.try_statement,
      $.throw_statement,
      $.const_declaration,
      $.enum_declaration,
      $.expression_statement,
    ),

    expression_statement: $ =>
      prec.right(choice(
        seq(
          $.expression,
          optional(';'),
        ),
        ';',
      )),

    block: $ => seq(
      '{',
      repeat($._statement),
      '}',
    ),

    if_statement: $ => prec.right(1, seq(
      'if',
      field('condition', $.parenthesized_expression),
      field('consequence', $._statement),
      optional($.else_statement),
    )),
    else_statement: $ => prec.right(1, seq(
      'else',
      field('alternative', $._statement),
    )),

    while_statement: $ => prec.right(seq(
      'while',
      '(', $.expression, ')',
      optional($._statement),
      // optional(';'),
    )),

    do_while_statement: $ => prec.right(seq(
      'do',
      $._statement,
      'while',
      '(', $.expression, ')',
      // optional(';'),
    )),

    switch_statement: $ => seq(
      'switch',
      '(', $.expression, ')',
      '{',
      repeat($.case_statement),
      optional($.default_statement),
      '}',
    ),
    case_statement: $ => seq(
      'case',
      field('case', $.expression),
      ':',
      repeat($._statement),
    ),
    default_statement: $ => seq(
      'default',
      ':',
      repeat($._statement),
    ),

    for_statement: $ => seq(
      'for',
      '(',
      field('initial', optional(choice($.expression, $.local_declaration))),
      ';',
      field('condition', optional($.expression)),
      ';',
      field('increment', optional($.expression)),
      ')',
      $._statement,
    ),

    foreach_statement: $ => seq(
      'foreach',
      '(',
      optional(seq(field('index', $.identifier), ',')),
      field('value', $.identifier),
      'in',
      field('collection', $.expression),
      ')',
      $._statement,
    ),

    break: _ => seq('break', ';'),

    continue: _ => seq('continue', ';'),

    return: $ => prec.right(seq(
      'return',
      optional(choice($.expression, $.table)),
      // NOTE: Feels like it should be explicitly ';' but some files omit this
      optional(';'),
    )),

    yield: $ => seq(
      'yield',
      optional($.expression),
      choice(';', '\n'),
    ),

    resume_expression: $ => seq(
      'resume',
      $.expression,
    ),

    local_declaration: $ => prec.left(seq('local', $._initz, optional(';'))),
    _initz: $ => prec.right(seq(
      $.identifier,
      optional(seq(choice('=', '<-'), choice($.expression, $.table))),
      optional(seq(',', $._initz)),
    )),

    function_declaration: $ => seq(
      'function',
      $.identifier,
      repeat(seq('::', $.identifier)),
      '(',
      optional($.parameters),
      ')',
      $._statement,
    ),
    parameters: $ => commaSep1($.parameter),
    parameter: $ => choice(
      seq(
        $.identifier,
        optional(seq('=', $.const_value)),
      ),
      '...',
    ),


    class_declaration: $ => seq(
      'class',
      $.identifier,
      repeat(seq('.', $.identifier)),
      optional(seq('extends', $.identifier)),
      optional($.attribute_declaration),
      '{',
      repeat($.member_declaration),
      '}',
    ),
    member_declaration: $ => seq(
      optional($.attribute_declaration),
      choice(
        seq(optional('static'), $.identifier, '=', choice($.expression, $.table), optional(';')),
        seq('[', $.expression, ']', '=', $.expression, optional(';')),
        $.function_declaration,
        seq('constructor', '(', optional($.parameters), ')', $._statement),
      ),
    ),

    try_statement: $ => seq(
      'try',
      $._statement,
      $.catch_statement,
    ),
    catch_statement: $ => seq(
      'catch',
      '(',
      $.identifier,
      ')',
      $._statement,
    ),

    throw_statement: $ => prec.right(seq(
      'throw',
      $.expression,
      optional(';'),
    )),

    const_declaration: $ => seq(
      'const',
      $.identifier,
      '=',
      $.const_value,
      // optional(';'),
      choice(';', '\n'),
    ),
    const_value: $ => choice(
      $.array,
      $.table,
      $.integer,
      $.float,
      $.string,
      $.verbatim_string,
      $.char,
      $.bool,
      $.null,
      $.call_expression,
      $.identifier,
      $.global_variable,
    ),

    enum_declaration: $ => prec.right(seq(
      'enum',
      $.identifier,
      optional($.attribute_declaration),
      '{',
      commaSep1(seq($.identifier, optional(seq('=', $.const_value)))),
      '}',
      optional(';'),
    )),

    attribute_declaration: $ => seq(
      '</',
      commaSep1(
        seq(
          field('left', $.identifier),
          field('operator', '='),
          field('right', $.const_value),
        ),
      ),
      '/>',
    ),

    expression: $ => choice(
      // $.table,
      $.delete_expression,
      $.clone_expression,
      $.array,
      $.assignment_expression,
      $.update_expression,
      $.resume_expression,
      $.primary_expression,
    ),

    primary_expression: $ => prec.right(choice(
      $.unary_expression,
      $.binary_expression,
      $.ternary_expression,
      $.anonymous_function,
      $.deref_expression,
      $.index_expression,
      $.call_expression,
      $.lambda_expression,
      $.parenthesized_expression,
      $.integer,
      $.float,
      $.string,
      $.verbatim_string,
      $.char,
      $.bool,
      $.null,
      $.identifier,
      $.global_variable,
    )),

    unary_expression: $ => prec.left(PREC.UNARY, choice(
      seq(
        field('operator', choice('-', '~', '!', 'typeof', '++', '--')),
        field('operand', choice($.expression, $.table)),
        optional(';'),
      ),
      seq(
        field('operand', $.expression),
        field('operator', choice('++', '--')),
        optional(';'),
      ),
    )),

    binary_expression: $ => {
      const table = [
        ['+', PREC.ADDITIVE],
        ['-', PREC.ADDITIVE],
        ['*', PREC.MULTIPLICATIVE],
        ['/', PREC.MULTIPLICATIVE],
        ['%', PREC.MULTIPLICATIVE],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['in', PREC.IN],
        ['|', PREC.INCLUSIVE_OR],
        ['^', PREC.EXCLUSIVE_OR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUALITY],
        ['!=', PREC.EQUALITY],
        ['<=>', PREC.COMPARISON],
        ['>', PREC.COMPARISON],
        ['>=', PREC.COMPARISON],
        ['<=', PREC.COMPARISON],
        ['<', PREC.COMPARISON],
        ['instanceof', PREC.INSTANCEOF],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
        ['>>>', PREC.SHIFT],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $.expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $.expression),
          optional(';'),
        ));
      }));
    },

    ternary_expression: $ => prec.right(PREC.TERNARY, seq(
      field('condition', $.expression),
      '?',
      field('consequence', choice($.expression, $.table)),
      ':',
      field('alternative', choice($.expression, $.table)),
    )),

    assignment_expression: $ => prec.right(PREC.ASSIGN, seq(
      field('left', $.expression),
      field('operator', '='),
      field('right', choice($.expression, $.table)),
    )),

    update_expression: $ => prec.right(PREC.ASSIGN, seq(
      field('left', $.expression),
      field('operator', choice(
        '<-',
        '+=',
        '-=',
        '*=',
        '/=',
        '%=',
      )),
      field('right', choice($.expression, $.table)),
    )),

    table: $ => prec.right(seq(
      '{',
      optional($.table_slots),
      '}',
      optional(seq('.', $.expression)),
    )),
    table_slots: $ => seq(
      optionalCommaSep($.table_slot),
      optional(','),
    ),
    table_slot: $ => choice(
      seq($.identifier, '=', choice($.expression, $.table)),
      seq('[', $.expression, ']', '=', choice($.expression, $.table)),
      seq($.expression, ':', choice($.expression, $.table)),
      $.function_declaration,
    ),

    delete_expression: $ => seq(
      'delete',
      $.expression,
      choice(';', '\n'),
    ),

    var_statement: $ => (seq(
      'var',
      $.identifier,
      '=',
      $.expression,
    )),

    deref_expression: $ => prec(PREC.MEMBER, choice(
      seq(
        $.expression,
        '.',
        $.identifier,
      ),
    )),

    index_expression: $ => prec.left(PREC.MEMBER, seq(
      field('object', $.expression),
      '[',
      field('index', $.expression),
      ']',
    )),

    call_expression: $ => prec.left(PREC.CALL, seq(
      choice(field('function', $.expression), 'rawcall'),
      '(',
      optional($.call_args),
      ')',
    )),

    call_args: $ => commaSep1(choice(
      $.expression,
      $.table,
    )),
    anonymous_function: $ => seq(
      'function',
      '(',
      optional($.parameters),
      ')',
      $._statement,
    ),

    lambda_expression: $ => seq(
      '@',
      '(',
      optional($.parameters),
      ')',
      $.expression,
    ),

    parenthesized_expression: $ => prec(PREC.PAREN, seq(
      '(',
      $.expression,
      ')',
    )),

    clone_expression: $ => prec.right(seq(
      'clone',
      $.expression,
      // optional(';'),
    )),

    array: $ => prec.right(seq(
      '[',
      commaSep($.expression),
      optional(','),
      ']',
    )),

    identifier: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    global_variable: $ => seq('::', $.identifier),

    // IntegerLiteral ::= [1-9][0-9]* | '0x' [0-9A-Fa-f]+ | ''' [.]+ ''' | 0[0-7]+
    integer: _ => token(choice(
      /0/,
      /-?[1-9][0-9]*/,
      /0[xX][0-9A-Fa-f]+/,
      /'''[.]+'''/,
      /0[0-7]+/,
    )),

    // FloatLiteral ::= [0-9]+ '.' [0-9]+
    // FloatLiteral ::= [0-9]+ '.' 'e'|'E' '+'|'-' [0-9]+
    float: _ => token(choice(
      /-?[0-9]+\.[0-9]+/,
      /[0-9]+\.[eE][+-]?[0-9]+/,
    )),

    string: $ => seq(
      '"',
      repeat(choice(
        $.string_content,
        $._escape_sequence,
      )),
      '"',
    ),

    // Workaround to https://github.com/tree-sitter/tree-sitter/issues/1156
    // We give names to the token_ constructs containing a regexp
    // so as to obtain a node in the CST.
    string_content: _ => token.immediate(prec(1, /[^"\\]+/)),

    char: $ => choice(
      seq(
        '\'',
        choice(
          $.escape_sequence,
          /[^\\']/,
        ),
        '\'',
      ),
      // workaround because for some reason the char literal '#' is being interpreted as a comment
      '\'#\'',
    ),

    _escape_sequence: $ =>
      choice(
        prec(2, token.immediate(seq('\\', /[^abfnrtvxu'\"\\\?]/))),
        prec(1, $.escape_sequence),
      ),

    escape_sequence: _ => token.immediate(seq(
      '\\',
      choice(
        /[^xu0-7]/,
        /[0-7]{1,3}/,
        /x[0-9a-fA-F]{2}/,
        /u[0-9a-fA-F]{4}/,
        /u\{[0-9a-fA-F]+\}/,
      ))),

    bool: _ => choice('true', 'false'),

    null: _ => 'null',

    comment: _ =>
      token(
        choice(
          seq('#', /.*/),
          seq('//', /(\\(.|\r?\n)|[^\\\n])*/),
          seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'),
        ),
      ),
  },
});

module.exports.PREC = PREC;

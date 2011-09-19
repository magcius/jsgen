
/************************************************************/
/**** JS GENERATOR & AST ****/
/************************************************************/

function JSGenerator() {
    this.buffer = "";
    this.tabs = "";
}

JSGenerator.prototype = {
    indent: function() {
        this.tabs += "\t";
    },

    outdent: function() {
        this.tabs = this.tabs.slice(1);
    },

    generate: function(ast) {
        if (ast === null)
            return "";

        var func = JSGenerator.prototype["gen_" + ast.type];
        var ret = func.call(this, ast);
        return ret;
    },

    gen_function: function(ast) {
        var name = this.generate(ast.name);
        var local = this.generate(ast.locals);
        var block = this.generate(ast.block);

        return this.tabs + "function " + name + "(" + local + ") " + block;
    },

    gen_statement: function(ast) {
        return this.tabs + this.generate(ast.subexpr) + ";";
    },

    gen_object_literal: function(ast) {
        return JSON.stringify(ast.object);
    },

    gen_array_literal: function(ast) {
        return JSON.stringify(ast.array);
    },

    gen_block: function(ast) {
        var buffer = this.tabs + "{\n";
        this.indent();
        buffer += ast.statements.map(this.generate, this).join("\n");
        this.outdent();
        buffer += "\n" + this.tabs + "}\n";
        return buffer;
    },

    gen_commalist: function(ast) {
        return ast.values.map(this.generate, this).join(", ");
    },

    gen_string: function(ast) {
        // Quotes a string: a"b => "a\"b"
        var qstr = ast.value.replace(/"/g, "\\\"");
        return '"' + qstr + '"';
    },

    gen_number: function(ast) {
        return ast.value.toFixed();
    },

    gen_identifier: function(ast) {
        return ast.value;
    },

    gen_call: function(ast) {
        var lhs = this.generate(ast.lhs);
        var rhs = this.generate(ast.rhs);
        return lhs + "(" + rhs + ")";
    },

    gen_get: function(ast) {
        return this.generate(ast.id);
    },

    gen_set: function(ast) {
        var lhs = this.generate(ast.id);
        var rhs = this.generate(ast.value);
        return lhs + " = " + rhs;
    },

    gen_var_declaration: function(ast) {
        return "var " + this.gen_commalist({ values: ast.values });
    },

    gen_prop: function(ast) {
        var lhs = this.generate(ast.obj);
        // Special case: a["b"] == a.b, so optimize for a FQN.
        if (ast.name.type == "identifier")
            return lhs + "." + ast.name.value;

        var rhs = this.generate(ast.name);
        return lhs + "[" + rhs + "]";
    },

    gen_binop: function(ast) {
        var lhs = this.generate(ast.lhs);
        var rhs = this.generate(ast.rhs);

        // Simple constant folding
        if (parseFloat(lhs) && parseFloat(rhs)) {
            var func = new Function(["a", "b"], "return a " + ast.token + " b;");
            return func(parseFloat(lhs), parseFloat(rhs)).toString();
        }
        return "(" + lhs + ast.token + rhs + ")";
    },

    gen_unaryop: function(ast) {
        var rhs = this.generate(ast.rhs);
        return "(" + ast.token + rhs + ")";
    },

    gen_return: function(ast) {
        var rhs = this.generate(ast.value);
        return "return " + rhs;
    },

    gen_throw: function(ast) {
        var rhs = this.generate(ast.value);
        return "throw " + rhs;
    }
};

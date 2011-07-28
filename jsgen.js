
// A simple language.
var code = ["pushglobal"  , null,
            "pushstring"  , "console",
            "getproperty" , null,
            "pushstring"  , "log",
            "getproperty" , null,
            "pushstring"  , "Logging: ",
            "getlocal"    , 0,
            "add"         , null,
            "call"        , 1];


/************************************************************/
/**** JS GENERATOR & AST ****/
/************************************************************/

function makeLocal(idx) {
    return "_N" + idx;
}

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

    gen_getlocal: function(ast) {
        return makeLocal(ast.idx);
    },

    gen_setlocal: function(ast) {
        var rhs = this.generate(ast.value);
        return makeLocal(ast.idx) + " = " + rhs;
    },

    gen_getprop: function(ast) {
        var lhs = this.generate(ast.obj);
        // Special case: a["b"] == a.b, so optimize for a FQN.
        if (ast.name.type == "string")
            return lhs + "." + ast.name.value;

        var rhs = this.generate(ast.name);
        return lhs + "[" + rhs + "]";
    },

    gen_setprop: function(ast) {
        // Piggyback off of getprop.
        var code = this.gen_getprop(ast);
        return code + " = " + this.generate(ast.value);
    },

    gen_binop: function(ast) {
        var lhs = this.generate(ast.lhs);
        var rhs = this.generate(ast.rhs);
        return "(" + lhs + ast.token + rhs + ")";
    },

    gen_return: function(ast) {
        var rhs = this.generate(ast.value);
        return "return " + rhs + ";";
    }
};

/************************************************************/
/** BYTECODE **/
/************************************************************/

var ByteCode = {
    pushstring: function(stack, arg) {
        stack.push({ type: "string", value: arg });
    },

    pushnumber: function(stack, arg) {
        stack.push({ type: "number", value: arg });
    },

    pushglobal: function(stack, arg) {
        stack.push({ type: "identifier", value: "window" });
    },

    getlocal: function(stack, arg) {
        stack.push({ type: "getlocal", idx: arg });
    },

    setlocal: function(stack, arg) {
        var value = stack.pop();
        stack.push({ type: "setlocal", idx: arg, value: value });
    },

    getproperty: function(stack, arg) {
        var name = stack.pop();
        var obj = stack.pop();
        stack.push({ type: "getprop", obj: obj, name: name });
    },

    setproperty: function(stack, arg) {
        var value = stack.pop();
        var name = stack.pop();
        var obj = stack.pop();
        stack.push({ type: "setprop", obj: obj, name: name, value: value });
    },
 
    call: function(stack, arg) {
        var lhs, rhs;
        if (arg == 0) {
            lhs = stack.pop();
            rhs = null;
        } else if (arg == 1) {
            rhs = stack.pop();
            lhs = stack.pop();
        } else {
            var values = [];
            while (arg --)
                values.unshift(stack.pop());
            var rhs = { type: "commalist", values: values };
            var lhs = stack.pop();
        }
        stack.push({ type: "call", lhs: lhs, rhs: rhs });
    }
};

var BINARY_OPERATORS = {
    "add": "+",
    "subtract": "-",
    "multiply": "*",
    "divide": "/",
    "mod": "%",
    "lshift": "<<",
    "rshift": ">>",
    "equals": "==",
    "notequals": "!=",
    "urshift": ">>>",
    "lessthan": "<",
    "lessequal": "<=",
    "greaterthan": ">",
    "greaterequal": ">=",

    "bitand": "&",
    "bitor": "|",
    "bitxor": "^",
    "and": "&&",
    "or": "||",

    "instanceof": "instanceof",
    "in": "in"
};

for (var binop in BINARY_OPERATORS) {
    ByteCode[binop] = (function(token) {
        return function(stack, arg) {
            var rhs = stack.pop();
            var lhs = stack.pop();
            stack.push({ type: "binop", token: token, lhs: lhs, rhs: rhs });
        };
    })(BINARY_OPERATORS[binop]);
}

function generate(name, code, nlocals) {
    var n = code.length, stack = [], i, local = [];
    for (i = 0; i < nlocals; i ++)
        local.push({ type: "identifier", value: makeLocal(i) });

    for (i = 0; i < n; i += 2) {
        var bname = code[i], arg = code[i+1];
        if (ByteCode.hasOwnProperty(bname))
            ByteCode[bname](stack, arg);
    }

    var statements = [];

    while (stack.length)
        statements.push({ type: "statement", subexpr: stack.pop() });

    var func = { type: "function",
                 name: { type: "identifier", value: name },
                 locals: { type: "commalist", values: local },
                 block: { type: "block", statements: statements }};

    return new JSGenerator().generate(func);
}


/************************************************************/
/** BYTECODE **/
/************************************************************/

function makeIdentifier(value) {
    return { type: "identifier", value: value };
}

function makeLocal(idx) {
    return makeIdentifier("_L"+idx);
}

var ABC = {
    pushstring: function(ctx, arg) {
        ctx.stack.push({ type: "string", value: arg });
    },

    pushdouble: function(ctx, arg) {
        ctx.stack.push({ type: "number", value: arg });
    },

    pushglobal: function(ctx) {
        ctx.stack.push(makeIdentifier("window"));
    },

    pushfalse: function(ctx) {
        ctx.stack.push(makeIdentifier("false"));
    },

    pushtrue: function(ctx) {
        ctx.stack.push(makeIdentifier("true"));
    },

    pushnull: function(ctx) {
        ctx.stack.push(makeIdentifier("null"));
    },

    pushundefined: function(ctx) {
        // "undefined" is slow and unsafe if someone redefines undefined,
        // so use the "void" expression instead
        ctx.stack.push(makeIdentifier("(void 0)"));
    },

    getlocal: function(ctx, idx) {
        ctx.stack.push(makeLocal(idx));
    },

    setlocal: function(ctx, idx) {
        var value = ctx.stack.pop();
        ctx.statements.push({ type: "set", id: makeLocal(idx), value: value });
        ctx.locals[idx] = makeLocal(idx);
    },

    kill: function(ctx, arg) {
        ABC.pushnull(stack);
        ABC.setlocal(stack, arg);
    },

    newarray: function(ctx, count) {
        var array = [];
        while (count --)
            array.unshift(ctx.stack.pop());
        ctx.stack.push({ type: "array_literal", array: array });
    },

    newobject: function(ctx, count) {
        var object = {};
        while (count --) {
            var val = ctx.stack.pop();
            var key = ctx.stack.pop();
            object[key] = val;
        }
        ctx.stack.push({ type: "object_literal", object: object });
    },

    getproperty: function(ctx, name) {
        // obj.name
        var obj = ctx.stack.pop();
        ctx.stack.push({ type: "get", id: { type: "prop", obj: obj, name: makeIdentifier(name) }});
    },

    setproperty: function(ctx, name) {
        // obj[name] = value
        // obj.name = value
        var value = ctx.stack.pop();
        var obj = ctx.stack.pop();
        ctx.statements.push({ type: "set",
                              id: { type: "prop", obj: obj, name: makeIdentifier(name) },
                              value: value });
    },
 
    findproperty: function(ctx, name) {
        ctx.statements.pop();
    },

    call: function(ctx, arg) {
        var lhs, rhs;
        if (arg == 0) {
            lhs = ctx.stack.pop();
            rhs = null;
        } else if (arg == 1) {
            rhs = ctx.stack.pop();
            lhs = ctx.stack.pop();
        } else {
            var values = [];
            while (arg --)
                values.unshift(ctx.stack.pop());
            var rhs = { type: "commalist", values: values };
            var lhs = ctx.stack.pop();
        }
        ctx.statements.push({ type: "call", lhs: lhs, rhs: rhs });
    },

    returnvalue: function(ctx) {
        var value = ctx.stack.pop();
        ctx.statements.push({ type: "return", value: value });
    },

    returnvoid: function(ctx) {
        ABC.pushundefined(ctx);
        ABC.returnvalue(ctx);
    },

    "throw": function(ctx) {
        var value = ctx.stack.pop();
        ctx.stack.push({ type: "throw", value: value });
    }
};

ABC.pushint = ABC.pushuint = ABC.pushshort = ABC.pushbyte = ABC.pushdouble;
ABC.initproperty = ABC.setproperty;

var BINARY_OPERATORS = {
    "add": "+",
    "add_i": "+",
    "subtract": "-",
    "subtract_i": "-",
    "multiply": "*",
    "multiply_i": "*",
    "divide": "/",
    "divide_i": "/",
    "modulo": "%",

    "lshift": "<<",
    "rshift": ">>",
    "equals": "==",
    "strictequals": "===",
    "urshift": ">>>",
    "lessthan": "<",
    "lessequals": "<=",
    "greaterthan": ">",
    "greaterequals": ">=",

    "bitand": "&",
    "bitor": "|",
    "bitxor": "^",
    "and": "&&",
    "or": "||",

    "instanceof": "instanceof",
    "in": "in"
};

for (var binop in BINARY_OPERATORS) {
    ABC[binop] = (function(token) {
        return function(ctx) {
            var rhs = ctx.stack.pop();
            var lhs = ctx.stack.pop();
            ctx.stack.push({ type: "binop", token: token, lhs: lhs, rhs: rhs });
        };
    })(BINARY_OPERATORS[binop]);
}

var UNARY_OPERATORS = {
    "not": "!",
    "bitnot": "~",
    "increment": "++",
    "decrement": "--",
    "increment_i": "++",
    "decrement_i": "--",
};

for (var unaryop in UNARY_OPERATORS) {
    ABC[unaryop] = (function(token) {
        return function(ctx) {
            var rhs = ctx.stack.pop();
            ctx.stack.push({ type: "unaryop", token: token, rhs: rhs });
        };
    })(UNARY_OPERATORS[unaryop]);
}

function generate(name, code, nargs) {
    var n = code.length, i, params = [];
    var ctx = {
        // value stack
        stack: [],

        // local tracking
        locals: {},

        statements: []
    };
    for (i = 0; i < nargs; i ++)
        params.push(makeLocal(i));

    for (i = 0; i < n; i += 2) {
        var bname = code[i], args = code[i+1];
        args.unshift(ctx);
        if (ABC.hasOwnProperty(bname))
            ABC[bname].apply(null, args);
    }

    var statements = ctx.statements;
    var locals = [];
    for (i in ctx.locals)
        if (i > nargs)
            locals.push(makeLocal(i));

    if (locals.length) {
        var prologue = { type: "var_declaration",
                         values: locals };
        statements.unshift(prologue);
    }

    n = statements.length;
    for (i = 0; i < n; i ++) {
        statements[i] = { type: "statement", subexpr: statements[i] };
    }

    var func = { type: "function",
                 name: { type: "identifier", value: name },
                 locals: { type: "commalist", values: params },
                 block: { type: "block", statements: statements }};

    return new JSGenerator().generate(func);
}

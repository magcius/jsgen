
/************************************************************/
/** BYTECODE **/
/************************************************************/

function makeLocal(idx) {
    return "_N" + idx;
}

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
        stack.push({ type: "getlocal", name: makeLocal(arg) });
    },

    setlocal: function(stack, arg) {
        var value = stack.pop();
        stack.push({ type: "setlocal", name: makeLocal(arg), value: value });
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
    },

    "return": function(stack, arg) {
        var value = stack.pop();
        stack.push({ type: "return", value: value });
    },

    "throw": function(stack, arg) {
        var value = stack.pop();
        stack.push({ type: "throw", value: value });
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

var UNARY_OPERATORS = {
    "not": "!",
    "bitnot": "~",
    "increment": "++",
    "decrement": "--",
};

for (var unaryop in UNARY_OPERATORS) {
    ByteCode[unaryop] = (function(token) {
        return function(stack, arg) {
            var rhs = stack.pop();
            stack.push({ type: "unaryop", token: token, rhs: rhs });
        };
    })(UNARY_OPERATORS[unaryop]);
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

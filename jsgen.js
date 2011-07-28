
// A simple language.
var code = ["pushglobal"  , null,
            "pushstring"  , "console",
            "getproperty" , null,
            "pushstring"  , "log",
            "getproperty" , null,
            "pushstring"  , "Hello, World!",
            "call"        , 1];


/************************************************************/
/** AST **/
/************************************************************/

var AST = {
    WindowConstant: function() {
        return { type: "window",
                 code: "window" };
    },

    StringConstant: function(value) {
        return { type: "string",
                 raw_value: value,
                 code: '"' + (value.replace(/"/g, "\\\"")) + '"' };
    },

    IntConstant: function(value) {
        return { type: "string",
                 raw_value: value,
                 code: value.toString() };
    },

    GetProperty: function(obj, name) {
        var code;
        if (name.type == "string") { // QName
            code = obj.code + "." + name.raw_value;
        } else {
            code = obj.code + "[" + name.code + "]";
        }

        return { type: "getprop",
                 code: code };
    },

    SetProperty: function(obj, name, value) {
        // Piggyback onto GetProperty.
        var code = AST.GetProperty(obj, name).code;
        code += " = " + value.code;
        return { type: "setprop",
                 code: code };
    },

    Local: function(idx) {
        return { type: "local",
                 code: "n" + idx };
    },

    Return: function(obj) {
        return { type: "return",
                 code: "return " + obj.code + ";" };
    },

    Call: function(obj, args) {
        var arg_str = args.map(function(v) { return v.code; }).join(", ");
        return { type: "call",
                 code: obj.code + "(" + arg_str + ")" };
    },
};

/************************************************************/
/** BYTECODE **/
/************************************************************/

var ByteCode = {
    pushstring: function(stack, arg) {
        stack.push(AST.StringConstant(arg));
    },

    pushint: function(stack, arg) {
        stack.push(AST.IntConstant(arg));
    },

    pushglobal: function(stack, arg) {
        stack.push(AST.WindowConstant());
    },

    getlocal: function(stack, arg) {
        stack.push(AST.Local(arg));
    },

    getproperty: function(stack, arg) {
        var name = stack.pop();
        var obj = stack.pop();
        stack.push(AST.GetProperty(obj, name));
    },
 
    call: function(stack, arg) {
        var call_args = [];
        while (arg --)
            call_args.unshift(stack.pop());
        var callable = stack.pop();
        stack.push(AST.Call(callable, call_args));
    },

    dup: function(stack, arg) {
        var obj = stack[stack.length-1];
        stack,push(obj);
    },

    pop: function(stack, arg) {
        stack.pop();
    }
};

function generate(code) {
    var n = code.length, stack = [], buffer = "";

    // Standard prologue.
    buffer += "function _generated() {\n";
    for (var i = 0; i < n; i += 2) {
        var name = code[i], arg = code[i+1];
        if (ByteCode.hasOwnProperty(name))
            ByteCode[name](stack, arg);
    }

    n = stack.length;
    while (n --)
        buffer += stack.pop().code + ";\n";

    // Epilogue.
    buffer += "}";
    return buffer;
}

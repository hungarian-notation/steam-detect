/**
 * This library provides a simple parser for the Valve KeyValue format.
 * 
 * It does not take any special pains to preserve the order of keys when 
 * the data is converted to JSON.
 * 
 * It supports comments and unquoted tokens, and it will silently accept and
 * ignore macros and any unexpected input. 
 * 
 * IMPORTANT:
 * This is not a robust parser. It is designed to allow the scraping of data 
 * from steam installations, not as a reliable or fast configuration library.
 * Junk input is silently ignored, and it has not been thoroughly tested against
 * anything except appmanifest files.
 * 
 * This library was written to be used from within Windows Script Host, so it 
 * only uses features implemented by the ancient Microsoft Active Scripting
 * "JScript" engine.
 */

var Vdf = {};

(function (Vdf) {

    Vdf.TOKEN_OPEN        = "TOKEN_OPEN";
    Vdf.TOKEN_CLOSE       = "TOKEN_CLOSE";

    Vdf.TOKEN_QUOTED      = "TOKEN_QUOTED";
    Vdf.TOKEN_UNQUOTED    = "TOKEN_RAW";

    Vdf.TOKEN_MACRO       = "TOKEN_MACRO";
    Vdf.TOKEN_COMMENT     = "TOKEN_COMMENT";
    Vdf.TOKEN_WHITESPACE  = "TOKEN_WHITESPACE";
    Vdf.TOKEN_NEWLINE     = "TOKEN_NEWLINE";
    Vdf.TOKEN_JUNK        = "TOKEN_JUNK";

    function GetTokens(source) {
        // var valueExp_src = "\"(?:[^\"\\]|\\.)*\""
        // var lines = src.split(new RegExp("[\r]?[\n]", "g"));    
    
        var tokens = [];    
        var cursorIndex = 0;
        var productions = [];

        function define(type, regexp, drop) {
            productions.push({ 
                type: type, 
                regexp: regexp, 
                drop: drop 
            });
        }

        define(Vdf.TOKEN_MACRO,         "([#][^\r\n]*)");
        define(Vdf.TOKEN_OPEN,          "([{])");
        define(Vdf.TOKEN_CLOSE,         "([}])");        

        define(Vdf.TOKEN_QUOTED,        "\"((?:[^\"\\\\]|\\\\.)*)\"");
        define(Vdf.TOKEN_UNQUOTED,      "([^{}\" \r\n\t]+)");                   // unquoted tokens are allowed in the 
                                                                                // spec

        define(Vdf.TOKEN_COMMENT,       "([/][^\r\n]*)", true);
        define(Vdf.TOKEN_NEWLINE,       "([\r]?[\n])", true);
        define(Vdf.TOKEN_WHITESPACE,    "([ \t]+)", true);
        define(Vdf.TOKEN_JUNK,          ".", true);

        function nextToken() {
            if (cursorIndex >= source.length) {
                return null;
            }

            var token = null;

            for (var production_i = 0; production_i < productions.length; production_i += 1) {
                var production          = productions[production_i];
                var regexp              = new RegExp("^" + production.regexp, "g");

                var targetSourceOffset  = cursorIndex;
                var targetSource        = source.substring(targetSourceOffset);
                regexp.lastIndex        = 0;

                var matched;
                if (matched = regexp.exec(targetSource)) {
                    token = { 
                        production: production,
                        type: production.type,
                        matched: matched[1],
                        text: targetSource.substring(0, regexp.lastIndex), 
                        from: cursorIndex, 
                        to: regexp.lastIndex + targetSourceOffset 
                    }

                    cursorIndex         = regexp.lastIndex + targetSourceOffset;
                    
                    if (!production.drop) {
                        tokens.push(token)
                    }
                    
                    return token;
                }
            }

            return null;
        }

        while (nextToken() != null) {
            // WScript.Echo(cursorIndex);
        }

        return tokens;
    }

    Vdf.GetTokens = GetTokens;

    
    var EscapeProcessors = [];

    function defineEscape(escape, result) {
        EscapeProcessors.push({ regexp: new RegExp(escape, "g"), replacement: result })
    }

    defineEscape("[\\\\][n]",     "\n");
    defineEscape("[\\\\][t]",     "\t");
    defineEscape("[\\\\][\\\\]",  "\\");
    defineEscape("[\\\\][\"]",    "\"");

    function Parse(source) {
        var tokens = Vdf.GetTokens(source);
        var document = {};
        var documentStack = [];
        var active_object   = document;
        var active_key      = null;

        function keyvalue(value) {
            active_object[active_key] = value;
            active_key = null;
        }

        function unquote(text) {
            for (var i = 0; i < EscapeProcessors.length; ++i) {
                var processor = EscapeProcessors[i];
                text = text.replace(processor.regexp, processor.replacement);
            }

            return text;
        }

        function consume(token) {
            var type = token.type;

            if (type == Vdf.TOKEN_QUOTED || type == Vdf.TOKEN_UNQUOTED) {
                var text = token.matched;

                if (type == Vdf.TOKEN_QUOTED) {
                    text = unquote(text);
                }

                if (active_key == null) {
                    active_key = text;
                } else {
                    keyvalue(text);
                }
            } else if (type == Vdf.TOKEN_OPEN) {
                if (active_key == null) {
                    // use an empty key for objects that begin where a key is expected
                    active_key = ""; // technically an error, but we're not validating inputs here
                }

                documentStack.push({
                    active_object: active_object, 
                    active_key: active_key
                });

                active_object   = {};
                active_key      = null;
            } else if (type == Vdf.TOKEN_CLOSE) {
                if (active_key != null) {                    
                    // catch any keys which are missing values at the end of an object
                    keyvalue(""); // technically an error, but we're not validating inputs here
                }

                var child_object = active_object;
                var popped      = documentStack.pop();
                active_object   = popped.active_object;
                active_key      = popped.active_key;
                keyvalue(child_object);
            }
        }

        for (var i = 0; i < tokens.length; ++i) {
            consume(tokens[i]);
        }

        return document;
    }

    Vdf.Parse = Parse;
})(Vdf);
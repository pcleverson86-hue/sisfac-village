var PasswordStrengthChecker = (function () {
    var checker = null;

    var SCORES_EXCELLENT = 100;
    var SCORES_GOOD = 75;
    var SCORES_BAD = 64;

    var UGLY_LEN = 7;

    var LEVEL_EXCELLENT = 0;
    var LEVEL_GOOD = 1;
    var LEVEL_BAD = 2;
    var LEVEL_UGLY = 3;

    var REASON_KEYBOARD = 0;
    var REASON_SEQUENCE = 1;
    var REASON_LENGTH = 2;
    var REASON_REPEATED_CHARS = 3;
    var REASON_REPEATED_SEQUENCE = 4;
    var REASON_LAST_VALUE = 5;

    var PATTERN_NO_PATTERN = 0;
    var PATTERN_REPEAT = 1;
    var PATTERN_SEQUENCE = 2;
    var PATTERN_KEYBOARD = 3;
    var PATTERN_REPEAT_SEQUENCE = 4;
    var PATTERN_LAST_VALUE = 5;

    var ALPHABET_ID_NONE = 0
    var ALPHABET_ID_DIGIT = 1
    var ALPHABET_ID_LATIN = 2
    var ALPHABET_ID_OTHER_BEGIN = 3

    var CARDINALITY_DIGIT = (0x00000100 | 10)
    var CARDINALITY_LATIN_UPPER = (0x00000200 | 26)
    var CARDINALITY_LATIN_LOWER = (0x00000300 | 26)
    var CARDINALITY_SPEC = (0x00000400 | 33)
    var CARDINALITY_NONPRINTABLE_ASCII = (0x00000500 | 33)


    function KasPassCheck() {
        var DBL_MAX = 1.7976931348623158e+308;
        var g_min_around_count = 3;
        var g_max_sequence_diff = 5;
        var g_min_sequence_count = 3;
        var g_min_repeat_count = 3;
        var g_middle_additional = 2;

        var cyrillic =
            "{\
                \"name\": \"cyrillic\",\
                \"alphabet_lower\" : \"абвгдеёжзийклмнопрстуфхцчшщъыьэюя\",\
                \"alphabet_upper\" : \"АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ\",\
                \"mapping_latin_qwerty_lower\" : \"f,dult\`;pbqrkvyjghcnea[wxio]sm'.z\",\
                \"mapping_latin_qwerty_upper\" : \"F<DULT~:PBQRKVYJGHCNEA{WXIO}SM\\\">Z\"\
            }";

        var german =
            "{\
                \"name\": \"german\",\
                \"alphabet_lower\": \"äöüß\",\
                \"alphabet_upper\" : \"ÄÖÜẞ\",\
                \"mapping_latin_qwerty_lower\" : \"';[-\",\
                \"mapping_latin_qwerty_upper\" : \"\\\":{_\"\
            }";

        if (typeof Object.assign != 'function') {
            Object.assign = function (target, varArgs) {
                'use strict';
                if (target == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }

                var to = Object(target);

                for (var index = 1; index < arguments.length; index++) {
                    var nextSource = arguments[index];

                    if (nextSource != null) {
                        for (var nextKey in nextSource) {
                            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                                to[nextKey] = nextSource[nextKey];
                            }
                        }
                    }
                }
                return to;
            };
        }

        function assert(value, message) {
            if (value != true) {
                message = "assert: " + message;
                throw message;
            }
        }

        function log2(number) {
            return Math.log(number) / Math.log(2);
        }

        function utf8_decode_char_size(data) {
            var ret = 0;
            var code = data.charCodeAt(0);
            var size = data.length;
            var ch = data[0];
            if ((ch >> 7) == 0 && size > 0) {
                ret = 1;
            }
            else if ((ch >> 5) == 0x6 && size > 1) {
                ret = 2;
            }
            else if ((ch >> 4) == 0xE && size > 2) {
                ret = 3;
            }
            else if ((ch >> 3) == 0x1E && size > 3) {
                ret = 4;
            }
            else {
                return 0;
            }

            assert(ret > 0);
            for (var k = 1; k < ret; k++) {
                if ((data[k] >> 6) != 2) {
                    return 0;
                }
            }

            return ret;
        }

        function utf8_to_vector32(utf8) {
            var ret = [];
            for (var i = 0; i < utf8.length; i++) {
                var chars = encodeURIComponent(utf8[i]);
                chars = unescape(chars);

                var a8 = [0, 0, 0, 0];
                var y = 0;
                for (var k = chars.length - 1; k >= 0; k--) {
                    a8[y] = chars.charCodeAt(k);
                    y++;
                }

                var val32 = 0xFFFFFFFF;
                val32 = (a8[3] & 0xFF) << 24;
                val32 = val32 | ((a8[2] & 0xFF) << 16);
                val32 = val32 | ((a8[1] & 0xFF) << 8);
                val32 = val32 | (a8[0] & 0xFF);
                ret.push({ ch: val32, ch_size: chars.length });
            }
            return ret;
        }

        function deserialize_built_in_alphabets() {
            var ret = [];
            ret.push(JSON.parse(cyrillic));
            ret.push(JSON.parse(german));

            for (var i = 0; i < ret.length; i++) {
                ret[i].vec32_lower = utf8_to_vector32(ret[i].alphabet_lower);
                ret[i].vec32_upper = utf8_to_vector32(ret[i].alphabet_upper);
            }

            return ret;
        }
        var built_in_alphabets = deserialize_built_in_alphabets();

        function mycopy(val) {
            return Object.assign({}, val);
        }

        function CharInfo() {
            this.cardinality = 0;
            this.alphabet_id = ALPHABET_ID_NONE;
            this.ch = 0;
            this.ch_size = 1;
            this.mapped_latin_key = -1;
            this.shift = false;
            this.islowercase = false;
            this.isuppercase = false;
            this.alphabet_index = 0; 
            this.around_keys = "";
        };

        function get_1byte_char_class(info) {
            var shift_spec = "~!@#$%^&*()_+{}:\"|<>?";

            var ch = String.fromCharCode(info.ch);
            info.mapped_latin_key = ch;
            info.around_keys = get_around_keys(ch);
            if (ch >= '0' && ch <= '9') {
                info.alphabet_index = ch.charCodeAt(0) - '0'.charCodeAt(0);
                info.cardinality = CARDINALITY_DIGIT;
                info.alphabet_id = ALPHABET_ID_DIGIT;
            }
            else if (ch >= 'a' && ch <= 'z') {
                info.alphabet_index = ch.charCodeAt(0) - 'a'.charCodeAt(0);
                info.alphabet_id = ALPHABET_ID_LATIN;
                info.cardinality = CARDINALITY_LATIN_LOWER;
                info.islowercase = true;

            }
            else if (ch >= 'A' && ch <= 'Z') {
                info.alphabet_index = info.alphabet_index = ch.charCodeAt(0) - 'A'.charCodeAt(0);
                info.alphabet_id = ALPHABET_ID_LATIN;
                info.cardinality = CARDINALITY_LATIN_UPPER;
                info.isuppercase = true;
                info.shift = true;
            }
            else if (info.ch < 0x7F && info.ch >= 0x20) 
            {
                info.cardinality = CARDINALITY_SPEC;
                info.shift = shift_spec.indexOf(ch) != -1;
            }
            else {
                info.cardinality = CARDINALITY_NONPRINTABLE_ASCII;
            }
        }

        function Compare(vec, count, off) {
            assert(count != 0, "Compare()");
            assert(vec.length > count, "Compare()");
            assert(vec.length - count >= off, "Compare()");

            for (var i = 0; i < count; i++) {
                if (vec[i].ch != vec[i + off].ch) {
                    return false;
                }
            }

            return true;
        }

        var g_map_keys = init_around_keys();
        function init_around_keys() {
            var ret = [];
            var keys_arr =
                [
                    "`~1!", "1!`q2~Q@", "2@1qw3!QW#", "3#2we4@WE$", "4$3er5#ER%", "5%4rt6$RT^", "6^5ty7%TY&", "7&6yu8^YU*",
                    "8*7ui9&UI(", "9(8io0*IO)", "0)9op-(OP_", "-_0p[=)P{+", "=+-[]_{}",
                    "qQ1asw2!ASW@", "wW2qasde3@QASDE#", "eE3wsdfr4#WSDFR$", "rR4edfgt5$EDFGT%", "tT5rfghy6%RFGHY^", "yY6tghju7^TGHJU&",
                    "uU7yhjki8&YHJKI*", "iI8ujklo9*UJKLO(", "oO9ikl;p0(IKL:P)", "pP0ol;'[-)OL:\"{_", "[{-p;'\\]=_P:\"|}+", "]}=['\\+{\"|",
                    "aAqzxswQZXSW", "sSwazxdeWAZXDE", "dDesxcfrESXCFR", "fFrdcvgtRDCVGT", "gGtfvbhyTFVBHY", "hHygbnjuYGBNJU", "jJuhnmkiUHNMKI",
                    "kKijm,loIJM<LO", "lLok,.;pOK<>:P", ";:pl./'[PL>?\"{", "'\"[;/\\]{:?|}", "\\|]'}\"",
                    "zZaxsAXS", "xXsz cdSZ CD", "cCdx vfDX VF", "vVfc bgFCBG ", "bBgvnh GVNH ", "nNhbmj HBMJ ", "mMjn,k JN<K ", ",<km.l KM>L ",
                    ".>l,/;L<?:", "/?';.\":>", "  xcvbnm,.XCVBNM<>"
                ];

            for (var i = 0; i < keys_arr.length; i++) {
                var str = keys_arr[i];
                ret.push({ key: str[0], value: str.substring(2) });
                ret.push({ key: str[1], value: str.substring(2) });
            }

            ret.pop(); 

            ret.sort();
            for (var i = 0; i < ret.length - 1; i++) {
                assert(ret[i].key != ret[i + 1].key, "logic error: map.key is not unique");
            }
            return ret;
        }

        function get_around_keys(ch) {

            for (var i in g_map_keys) {
                if (g_map_keys[i].key == ch) {
                    return g_map_keys[i].value;
                }
            }
            return "";
        }

        function DIFF(a, b) {
            if (a > b) {
                return a - b;
            }
            return b - a;
        }

        function is_diff_equal(val1, val2, needed) {
            if ((val1.alphabet_id == ALPHABET_ID_NONE) || (val1.alphabet_id != val2.alphabet_id)) {
                return false;
            }
            var diff = DIFF(val1.alphabet_index, val2.alphabet_index);
            return diff == needed;
        }

        function Scores() {
            this.begin = 0;
            this.count = 0;
            this.entropy = 0.0;
            this.multipart_entropy = 0.0;
            this.type = PATTERN_NO_PATTERN;
            this.repeat = 1;
        };

        function Context() {
            this.path = [];
            this.char_info = []
            this.begin = -1;
            this.char_entropy = 0.0;
        };

        function add_scores(path_arr, scores, payload_count) {

            if (scores.begin && scores.count != payload_count && scores.type != PATTERN_NO_PATTERN) {
                scores.multipart_entropy = scores.entropy + g_middle_additional;
            }
            else {
                scores.multipart_entropy = scores.entropy;
            }

            var idx = 0;
            for (; idx < path_arr.length; ++idx) {
                var el = path_arr[idx];
                if (el.count < scores.count) {
                    continue;
                }

                if (el.count > scores.count) {
                    break;
                }

                if (el.multipart_entropy > scores.multipart_entropy) {
                    path_arr.splice(idx, 0, mycopy(scores));
                }
                return;
            }

            path_arr.splice(idx, 0, mycopy(scores));
        }

        function add_multiple_pattern_scores(path_arr, char_info, scores) {
            var repeat = 2;
            var multi = mycopy(scores);
            var off = scores.count;
            while (off + scores.count <= char_info.length) {
                if (!Compare(char_info, scores.count, off)) {
                    break;
                }
                off += scores.count;
                multi.count = off;
                multi.entropy = scores.entropy + log2(repeat);
                multi.repeat = repeat;
                add_scores(path_arr, multi, char_info.length);
                repeat++;
            }
        }

        function get_keys_count(char_info_arr, size) {
            assert(char_info_arr.length >= size, "get_keys_count()");
            var count = 1;
            for (var i = 1; i < size; i++) {
                var left = char_info_arr[i - 1];
                var right = char_info_arr[i];
                if (-1 == left.around_keys.indexOf(right.mapped_latin_key)) {
                    break;
                }
                count++;
            }
            return count;
        }

        function add_around_key_scores(ctx) {
            var count = ctx.char_info.length;
            while (count >= g_min_around_count) {
                count = get_keys_count(ctx.char_info, count);
                if (count < g_min_around_count) {
                    break;
                }
                var shift = 0;
                for (var i = 0; i < count; i++) {
                    if (ctx.char_info[i].shift) {
                        shift++;
                    }
                }

                var ent = ctx.char_entropy;
                var K = shift != 0 && shift != count ? 1 : 0.5;
                for (var i = 0; i < count - 1; i++) {
                    var d = ctx.char_info[i].around_keys.length * K;
                    ent += log2(d);
                }

                var scores = new Scores;
                scores.count = count;
                scores.entropy = ent;
                scores.begin = ctx.begin;
                scores.type = PATTERN_KEYBOARD;
                add_multiple_pattern_scores(ctx.path, ctx.char_info, scores);
                add_scores(ctx.path, scores, ctx.char_info.length);
                count--;
            }
        }

        function add_repeated_sequence_scores(ctx) {
            for (var count = Math.floor(ctx.char_info.length / 2); count > 1; count--) {
                var repeat = 2;
                var off = count;
                while (off + count <= ctx.char_info.length) {
                    if (false == Compare(ctx.char_info, count, off)) {
                        break;
                    }

                    var cardinality = get_cardinality(ctx.char_info, count);
                    var scores = new Scores;
                    scores.type = PATTERN_REPEAT_SEQUENCE;
                    scores.repeat = repeat;
                    scores.entropy = log2(cardinality) * count + log2(repeat);
                    scores.begin = ctx.begin;
                    off += count;
                    scores.count = off;
                    add_scores(ctx.path, scores, ctx.char_info.length);
                    repeat++;
                }
            }
        }

        function add_repeated_chars_scores(ctx) {
            var repeat = 1;
            for (; repeat < ctx.char_info.length; repeat++) {
                if (ctx.char_info[0].ch != ctx.char_info[repeat].ch) {
                    break;
                }
            }

            if (repeat >= g_min_repeat_count) {
                var cardinality = get_cardinality(ctx.char_info, 1);
                var scores = new Scores;
                scores.type = PATTERN_REPEAT;
                scores.begin = ctx.begin;
                for (var i = repeat; i >= g_min_repeat_count; --i) {
                    scores.count = i;
                    scores.entropy = log2(cardinality * i);
                    add_scores(ctx.path, scores, ctx.char_info.length);
                }
            }
        }

        function get_ascii_sequence_addition_entrophy(char_info, count) {
            var first = char_info[0];
            var second = char_info[1];
            var ent = 0;
            var tmp = "aAzZ019";
            var idx = tmp.indexOf(first.mapped_latin_key);
            if (idx != -1) {
                ent = 1;
            }
            else {
                ent = log2(get_cardinality(char_info, count));
            }

            if (first.alphabet_index > second.alphabet_index) {
                ent += 1;
            }
            return ent;
        }

        function get_utf8_sequence_addition_entrophy(char_info, count) {
            var first = char_info[0];
            var second = char_info[1];

            var ent = 0;

            if (first.alphabet_index == 0 || first.alphabet_index == (0x000000FF & first.cardinality) - 1) {
                ent = 1;
            }
            else {
                ent = log2(get_cardinality(char_info, count));
            }

            if (first.alphabet_index > second.alphabet_index) {
                ent += 1;
            }
            return ent;
        }

        function get_sequence_addition_entrophy(char_info, count) {
            if (char_info[0].ch_size == 1) {
                return get_ascii_sequence_addition_entrophy(char_info, count);
            }

            return get_utf8_sequence_addition_entrophy(char_info, count);
        }

        function add_sequences_scores(ctx) {
            if (ctx.char_info.length < g_min_sequence_count) {
                return;
            }
            var needed_diff = DIFF(ctx.char_info[0].alphabet_index, ctx.char_info[1].alphabet_index);
            if (needed_diff == 0 || needed_diff > g_max_sequence_diff) {
                return;
            }

            var count = 2;
            for (; count < ctx.char_info.length; count++) {
                if (!is_diff_equal(ctx.char_info[0], ctx.char_info[count], needed_diff * count)) {
                    break;
                }
            }
            if (count < g_min_sequence_count) {
                return;
            }

            var scores = new Scores;
            scores.type = PATTERN_SEQUENCE;
            scores.begin = ctx.begin;

            for (; count >= g_min_sequence_count; count--) {
                var ent = get_sequence_addition_entrophy(ctx.char_info, count);
                scores.count = count;
                scores.entropy = ent + log2(count);
                add_multiple_pattern_scores(ctx.path, ctx.char_info, scores);
                add_scores(ctx.path, scores, ctx.char_info.length);
            }
        }

        function get_cardinality(char_info_arr, count) {
            var cardinality = []
            var ret = 0;
            for (var i = 0; i < count; i++) {
                cardinality.push(char_info_arr[i].cardinality);
            }
            cardinality.sort();
            for (var i = 0; i < cardinality.length - 1; i++) {
                while (cardinality.length > 1 && cardinality[i] == cardinality[i + 1]) {
                    cardinality.splice(i, 1);
                }
            }
            for (var i in cardinality) {
                ret += cardinality[i] & 0x000000FF;
            }
            return ret;
        }


        function prepare_for_calculate(str, alphabets) {
            var ret = [];
            var vec = utf8_to_vector32(str);
            for (var i = 0; i < vec.length; i++) {
                var val = new CharInfo;
                val.ch = vec[i].ch;
                val.ch_size = vec[i].ch_size;
                if (val.ch_size == 1) {
                    get_1byte_char_class(val);
                }
                ret.push(val);
            }

            var current_alphabet_id = ALPHABET_ID_OTHER_BEGIN;
            var cardinality_id_inc = 0x00010000;
            var cardinality_id_mask = cardinality_id_inc;

            for (var k = 0; k < alphabets.length; k++) {
                var mapping = alphabets[k].mapping_latin_qwerty_lower;
                var alphabet = alphabets[k].vec32_lower;
                var n = false;
                for (; ;) {
                    for (var i = 0; i < ret.length; i++) {
                        var char_info = ret[i];
                        for (var idx = 0; idx < alphabet.length; idx++) {
                            if (alphabet[idx].ch == char_info.ch) {
                                char_info.islowercase = !n;
                                char_info.isuppercase = n;
                                char_info.shift = n;
                                char_info.alphabet_id = current_alphabet_id;
                                char_info.cardinality = cardinality_id_mask + alphabet.length;
                                char_info.alphabet_index = idx;
                                char_info.mapped_latin_key = mapping[idx];
                                char_info.around_keys = get_around_keys(char_info.mapped_latin_key);
                                break;
                            }
                        }
                    }
                    if (n) {
                        break;
                    }
                    n = true;
                    mapping = alphabets[k].mapping_latin_qwerty_upper;
                    alphabet = alphabets[k].vec32_upper;
                    cardinality_id_mask += cardinality_id_inc;
                }
                current_alphabet_id++;
            }

            for (var i = 0; i < ret.length; i++) {
                if (ret[i].cardinality == 0) {
                    ret[i].cardinality = (cardinality_id_mask + (ret[i].ch_size << 16)) | 66;
                }
            }
            return ret;
        }

        this.get_scores = function (str, path) {

            var char_info_arr = prepare_for_calculate(str, built_in_alphabets);
            var char_entropy = log2(get_cardinality(char_info_arr, char_info_arr.length));

            function Node() {
                this.path = [];
                this.path.length = 0;
                this.from = new Scores;
                this.checked = false;
                this.entropy = DBL_MAX;
            };

            var graph = new Array(str.length + 1);
            for (var i = 0; i < graph.length; i++) {
                graph[i] = new Node;
            }

            graph[0].entropy = 0.0;
            var ctx = new Context;
            ctx.char_entropy = char_entropy;
            for (var i = 0; i < str.length; i++) {
                ctx.char_info = char_info_arr;
                ctx.begin = i;
                ctx.path = graph[i].path;
                add_around_key_scores(ctx);
                add_sequences_scores(ctx);
                add_repeated_chars_scores(ctx);
                add_repeated_sequence_scores(ctx);
                char_info_arr.shift();
            }

            var buf = [];
            for (var i = 0; i <= str.length; i++) {
                buf.push(0);
            }

            buf[0] = 1;
            buf[str.length] = 1;
            for (var i = 0; i < str.length; ++i) {
                for (var j = 0; j < graph[i].path.length; j++) {
                    var scores = graph[i].path[j];
                    buf[scores.begin] = 1;
                    buf[scores.begin + scores.count] = 1;
                }
            }

            for (var i = 0; i < str.length; i++) {
                if (buf[i] == 0) {
                    continue;
                }
                var payload_count = str.length - i;
                var scores = new Scores;
                scores.begin = i;
                for (var j = i + 1; j <= str.length; j++) {
                    if (buf[j] != 0) {
                        scores.count = j - i;
                        scores.entropy = char_entropy * scores.count;
                        add_scores(graph[i].path, scores, payload_count);
                    }
                }
            }

            for (var unused = 0; unused < str.length; unused++) {
                var min_idx = graph.length - 1;
                for (var i = 0; i < graph.length; i++) {
                    var node = graph[i];
                    if (!node.checked && (node.entropy < graph[min_idx].entropy)) {
                        min_idx = i;
                    }
                }

                var min_node = graph[min_idx];
                min_node.checked = true;

                for (var i = 0; i < min_node.path.length; i++) {
                    scores = min_node.path[i];
                    var end_idx = min_idx + scores.count;
                    var end_node = graph[end_idx];
                    var ent = min_node.entropy + scores.multipart_entropy;
                    if (!end_node.checked && (ent < end_node.entropy)) {
                        end_node.entropy = ent;
                        end_node.from = mycopy(scores);
                    }
                }
            }
            path.length = 0;
            var score = graph[graph.length - 1].from;
            for (; ;) {
                path.unshift(score);
                if (score.begin == 0) {
                    break;
                }
                assert(path.length != graph.length);
                score = graph[score.begin].from;
            }
            return graph[graph.length - 1].entropy;
        }

    } 

    this.get_type_string = function (scores) {

        var type_strings = ["NO_PATTERN", "REPEAT_CHAR", "SEQUENCE", "KEYBOARD", "REPEAT_SEQUENCE"];
        if (scores.type >= 0 && scores.type < PATTERN_LAST_VALUE) {
            return type_strings[scores.type];
        }
        return "";
    }

    function get_reason_string(reason) {
        switch (reason) {
            case REASON_KEYBOARD:
                return "KEYBOARD";
            case REASON_SEQUENCE:
                return "SEQUENCE";
            case REASON_LENGTH:
                return "LENGTH";
            case REASON_REPEATED_CHARS:
                return "REPEATED_CHARS";
            case REASON_REPEATED_SEQUENCE:
                return "REPEATED_SEQUENCE";
        }
        return "UNKNOWN REASON";
    }

    function get_level(scores) {

        if (scores >= SCORES_EXCELLENT) {
            return LEVEL_EXCELLENT;
        }
        if (scores >= SCORES_GOOD) {
            return LEVEL_GOOD;
        }
        if (scores >= SCORES_BAD) {
            return LEVEL_BAD;
        }
        return LEVEL_UGLY;
    }

    function get_weights(path) {
        var arr = [];
        for (var i = 0; i < REASON_LAST_VALUE; i++) {
            arr.push({ weight: 0, reason: i });
        }

        for (var i = 0; i < path.length; i++) {
            var val = path[i];
            if (val.type == PATTERN_REPEAT) {
                arr[REASON_REPEATED_CHARS].weight += val.count;
            }
            else if (val.type == PATTERN_KEYBOARD) {
                arr[REASON_KEYBOARD].weight += val.count;
            }
            else if (val.type == PATTERN_SEQUENCE) {
                arr[REASON_SEQUENCE].weight += val.count;
            }
        }
        var path_back = path[path.length - 1];
        var pass_len = path_back.begin + path_back.count;
        if (pass_len <= UGLY_LEN) {
            arr[REASON_LENGTH].weight = 1 + UGLY_LEN - pass_len;
        }

        arr.sort(function (a, b) {
            if (a == b) return 0;
            if (a.weight < b.weight) return 1;
            return -1;
        });

        for (var i = 0; i < arr.length; i++) {

            if (arr[i].weight == 0) {
                arr.splice(i);
                break;
            }
        }
        return arr;
    }

    function get_password_strength(value) {
        if (!checker) {
            checker = new KasPassCheck();
        }

        var shortest_path = [];
        var scores = checker.get_scores(value, shortest_path);
        var rs = [];

        var level = get_level(scores);
        if (level != checker.Level_EXCELLENT) {
            rs = get_weights(shortest_path);
        }

        return { quality: level, reasons: rs, entropy: scores, shortest_path: shortest_path };
    }

    return {
        getPasswordStrength: get_password_strength,
        getReasonString: get_reason_string

    };
})();

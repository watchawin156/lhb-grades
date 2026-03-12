var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/data.ts
var onRequest = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  const db = env.DB;
  const sdb = env.STUDENTS_DB;
  if (!db || !sdb) {
    return Response.json({ error: "One or more D1 bindings not found" }, { status: 500 });
  }
  if (request.method === "GET") {
    try {
      const url = new URL(request.url);
      const filterGrade = url.searchParams.get("grade");
      const filterYear = url.searchParams.get("year");
      let studentsQuery = "SELECT * FROM students";
      const params = [];
      if (filterGrade || filterYear) {
        studentsQuery += " WHERE ";
        const conditions = [];
        if (filterGrade) {
          conditions.push("grade LIKE ?");
          params.push(`%${filterGrade}%`);
        }
        if (filterYear) {
          conditions.push("academicYear = ?");
          params.push(filterYear);
        }
        studentsQuery += conditions.join(" AND ");
      }
      let subjectsQuery = "SELECT * FROM subjects";
      const subParams = [];
      if (filterGrade) {
        subjectsQuery += " WHERE class_level = ? AND (year = ? OR year IS NULL)";
        subParams.push(filterGrade, Number(filterYear) || 0);
      }
      const [stdRes, subRes, scoRes] = await Promise.all([
        sdb.prepare(studentsQuery).bind(...params).all(),
        db.prepare(subjectsQuery).bind(...subParams).all(),
        db.prepare("SELECT * FROM scores").all()
      ]);
      const students = stdRes.results.map((s) => ({
        id: s.id,
        code: s.studentId || "",
        name: `${s.prefix || ""}${s.firstName || ""} ${s.lastName || ""}`.trim(),
        class: s.grade || "",
        room: s.room || "",
        number: s.number || "",
        year: Number(s.academicYear) || 2568,
        status: s.status || "\u0E1B\u0E01\u0E15\u0E34"
      }));
      students.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        const gradeA = a.class || "";
        const gradeB = b.class || "";
        if (gradeA !== gradeB) return gradeA.localeCompare(gradeB);
        const numA = parseInt(a.number) || 999;
        const numB = parseInt(b.number) || 999;
        return numA - numB;
      });
      const d1Scores = scoRes.results;
      const scoreMap = {};
      d1Scores.forEach((s) => {
        const key = `${s.student_internal_id}-${s.subject_internal_id}-${s.academic_year}`;
        if (!scoreMap[key]) {
          scoreMap[key] = {
            studentId: s.student_internal_id,
            subjectId: s.subject_internal_id,
            score1: 0,
            score2: 0,
            year: s.academic_year
          };
        }
        if (s.semester === 1) scoreMap[key].score1 = s.score;
        if (s.semester === 2) scoreMap[key].score2 = s.score;
      });
      return Response.json({
        students,
        subjects: subRes.results,
        scores: Object.values(scoreMap)
      });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }
  if (request.method === "POST") {
    try {
      const { students = [], subjects = [], scores = [] } = await request.json();
      const gradeQueries = [];
      const studentQueries = [];
      students.forEach((s) => {
        const fullName = (s.name || "").trim();
        const parts = fullName.split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";
        studentQueries.push(sdb.prepare(`
                    INSERT OR REPLACE INTO students 
                    (id, studentId, firstName, lastName, grade, room, number, academicYear, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(s.id, s.code, firstName, lastName, s.class, s.room || null, s.number || null, s.year.toString(), s.status || "\u0E1B\u0E01\u0E15\u0E34"));
      });
      gradeQueries.push(db.prepare("DELETE FROM subjects"));
      subjects.forEach((s) => {
        gradeQueries.push(db.prepare("INSERT INTO subjects (id, code, name, maxScore, semester, type, credit, class_level, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(s.id, s.code, s.name, s.maxScore, s.semester, s.type || "\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19", s.credit || 1, s.class_level, s.year));
      });
      gradeQueries.push(db.prepare("DELETE FROM scores"));
      scores.forEach((s) => {
        if (s.score1 !== void 0) {
          gradeQueries.push(db.prepare("INSERT INTO scores (student_internal_id, subject_internal_id, score, academic_year, semester) VALUES (?, ?, ?, ?, ?)").bind(s.studentId, s.subjectId, s.score1, Number(s.year), 1));
        }
        if (s.score2 !== void 0) {
          gradeQueries.push(db.prepare("INSERT INTO scores (student_internal_id, subject_internal_id, score, academic_year, semester) VALUES (?, ?, ?, ?, ?)").bind(s.studentId, s.subjectId, s.score2, Number(s.year), 2));
        }
      });
      await Promise.all([
        sdb.batch(studentQueries),
        db.batch(gradeQueries)
      ]);
      return Response.json({ success: true });
    } catch (error) {
      console.error("D1 Batch Error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}, "onRequest");

// api/telegram-backup.ts
var onRequest2 = /* @__PURE__ */ __name(async (context) => {
  const { request } = context;
  const BOT_TOKEN = "8505492579:AAHWRjIcdINKMetnp1bKcXt0xecVSoChSr8";
  const CHAT_ID = "-1003201809285";
  const MESSAGE_THREAD_ID = 7900;
  const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { students, subjects, scores, academicYear } = body;
      const backupData = {
        version: 1,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        academicYear,
        students,
        subjects,
        scores
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const formData = new FormData();
      formData.append("chat_id", CHAT_ID);
      formData.append("message_thread_id", String(MESSAGE_THREAD_ID));
      formData.append("document", blob, `backup_${academicYear}_${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.json`);
      formData.append("caption", `\u{1F4E6} \u0E2A\u0E33\u0E23\u0E2D\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 | \u0E1B\u0E35\u0E01\u0E32\u0E23\u0E28\u0E36\u0E01\u0E29\u0E32 ${academicYear} | \u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19 ${students.length} \u0E04\u0E19 | \u0E27\u0E34\u0E0A\u0E32 ${subjects.length} \u0E23\u0E32\u0E22\u0E27\u0E34\u0E0A\u0E32 | ${(/* @__PURE__ */ new Date()).toLocaleString("th-TH")}`);
      const tgRes = await fetch(`${TG_API}/sendDocument`, {
        method: "POST",
        body: formData
      });
      if (!tgRes.ok) {
        const err = await tgRes.json();
        return Response.json({ ok: false, error: err }, { status: 502 });
      }
      const result = await tgRes.json();
      return Response.json({ ok: true, messageId: result.result?.message_id });
    } catch (e) {
      return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
  }
  if (request.method === "GET") {
    try {
      const res = await fetch(
        `${TG_API}/getUpdates?limit=100&timeout=0`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        return Response.json({ ok: false, error: "Failed to get updates" }, { status: 502 });
      }
      const data = await res.json();
      const updates = data.result || [];
      let latestDoc = null;
      for (let i = updates.length - 1; i >= 0; i--) {
        const msg = updates[i].message || updates[i].channel_post;
        if (!msg) continue;
        const matchChat = String(msg.chat?.id) === CHAT_ID;
        const matchThread = msg.message_thread_id === MESSAGE_THREAD_ID;
        if (matchChat && matchThread && msg.document) {
          latestDoc = msg.document;
          break;
        }
      }
      if (!latestDoc) {
        return Response.json({ ok: false, error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A backup \u0E43\u0E19 Telegram" }, { status: 404 });
      }
      const fileRes = await fetch(`${TG_API}/getFile?file_id=${latestDoc.file_id}`);
      const fileData = await fileRes.json();
      const filePath = fileData.result?.file_path;
      if (!filePath) {
        return Response.json({ ok: false, error: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E14\u0E36\u0E07\u0E44\u0E1F\u0E25\u0E4C\u0E44\u0E14\u0E49" }, { status: 502 });
      }
      const downloadRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
      const json = await downloadRes.json();
      return Response.json({ ok: true, data: json });
    } catch (e) {
      return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
  }
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}, "onRequest");

// ../.wrangler/tmp/pages-ApaR4b/functionsRoutes-0.9285810061419582.mjs
var routes = [
  {
    routePath: "/api/data",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/telegram-backup",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  }
];

// ../node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};

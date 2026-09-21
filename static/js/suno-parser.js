/* global window, fetch */
/**
 * Suno RSC flight parser (shared between the parser and the downloader).
 *
 * Exposes `window.SunoParser` with:
 *   - DEFAULT_PROXY
 *   - extractId(raw)                         → UUID string or ""
 *   - parseHtml(html, id)                    → clip object (never throws)
 *   - fetchAndParse(id, proxy, signal)       → Promise<clip> (throws on HTTP/empty)
 *
 * The returned clip object has these fields (plus whatever Suno ships in it):
 *   id, title, display_name, handle, created_at,
 *   image_url, audio_url, video_url,
 *   metadata: { tags, prompt, duration, ... },
 *   _hook: true, hook_id, hook_duration, hook_caption  // present for public Hooks
 *   _fallback: true   // present when the RSC pipeline failed
 *
 * See docs/suno-parser.md for background on the parsing pipeline.
 */
(function () {
    "use strict";

    var UUID_RE =
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

    var SHORT_RE = /suno\.com\/s\/([A-Za-z0-9_-]+)/i;
    var HOOK_RE = /suno\.com\/hook\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

    var DEFAULT_PROXY = "/api/suno/proxy?url=";
    var HOOK_API = "https://studio-api-prod.suno.com/api/video/hooks/";

    function extractId(raw) {
        if (!raw) return "";
        var str = String(raw).trim();
        var h = str.match(HOOK_RE);
        if (h) return "h:" + h[1].toLowerCase();
        var m = str.match(UUID_RE);
        if (m) return m[0].toLowerCase();
        var s = str.match(SHORT_RE);
        if (s) return "s:" + s[1];
        return "";
    }

    // Concatenate every self.__next_f.push([1,"…"]) string literal in order.
    function collectPayload(html) {
        var re =
            /self\.__next_f\.push\(\[\s*1\s*,\s*"((?:\\.|[^"\\])*)"\s*\]\)/g;
        var out = "";
        var m;
        while ((m = re.exec(html)) !== null) {
            try {
                out += JSON.parse('"' + m[1] + '"');
            } catch (e) {
                out += m[1]
                    .replace(/\\n/g, "\n")
                    .replace(/\\r/g, "\r")
                    .replace(/\\t/g, "\t")
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, "\\");
            }
        }
        return out;
    }

    // Read N UTF-8 bytes starting at char index `start`.
    function readNBytes(s, start, byteLen) {
        var got = 0;
        var i = start;
        while (i < s.length && got < byteLen) {
            var code = s.charCodeAt(i);
            var step = 1;
            var bytes;
            if (code < 0x80) bytes = 1;
            else if (code < 0x800) bytes = 2;
            else if (code >= 0xd800 && code <= 0xdbff) {
                bytes = 4;
                step = 2;
            } else bytes = 3;
            got += bytes;
            i += step;
        }
        return { text: s.substring(start, i), nextCharIdx: i };
    }

    // Read one JSON value (object / array / string / scalar) starting at `start`.
    function readJsonValue(s, start) {
        var i = start;
        while (i < s.length && /\s/.test(s.charAt(i))) i++;
        if (i >= s.length) return null;
        var c = s.charAt(i);

        if (c === '"') {
            var j = i + 1;
            while (j < s.length) {
                var ch = s.charAt(j);
                if (ch === "\\") { j += 2; continue; }
                if (ch === '"') { j++; break; }
                j++;
            }
            return { raw: s.substring(i, j), end: j };
        }

        if (c === "{" || c === "[") {
            var stack = [c];
            var k = i + 1;
            while (k < s.length && stack.length) {
                var cc = s.charAt(k);
                if (cc === '"') {
                    k++;
                    while (k < s.length) {
                        if (s.charAt(k) === "\\") { k += 2; continue; }
                        if (s.charAt(k) === '"') { k++; break; }
                        k++;
                    }
                    continue;
                }
                if (cc === "{" || cc === "[") stack.push(cc);
                else if (cc === "}" || cc === "]") stack.pop();
                k++;
            }
            return { raw: s.substring(i, k), end: k };
        }

        var scalar = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
            s.substring(i)
        );
        if (scalar) return { raw: scalar[0], end: i + scalar[0].length };
        return null;
    }

    function parseFlight(payload) {
        var map = new Map();
        var i = 0;
        var n = payload.length;
        while (i < n) {
            var j = i;
            while (j < n && /[0-9a-f]/i.test(payload.charAt(j))) j++;
            if (j === i || payload.charAt(j) !== ":") { i = j + 1; continue; }
            var id = payload.substring(i, j).toLowerCase();
            var k = j + 1;
            var typeCh = payload.charAt(k);

            if (typeCh === "T") {
                var hexStart = k + 1;
                var m = hexStart;
                while (m < n && /[0-9a-f]/i.test(payload.charAt(m))) m++;
                if (payload.charAt(m) !== ",") { i = m + 1; continue; }
                var byteLen = parseInt(payload.substring(hexStart, m), 16);
                var got = readNBytes(payload, m + 1, byteLen);
                map.set(id, { type: "T", value: got.text });
                i = got.nextCharIdx;
                if (payload.charAt(i) === "\n") i++;
                continue;
            }

            if (
                typeCh === "I" || typeCh === "H" || typeCh === "M" ||
                typeCh === "J" || typeCh === "L"
            ) {
                var v = readJsonValue(payload, k + 1);
                if (v) {
                    var parsed;
                    try { parsed = JSON.parse(v.raw); } catch (e) { parsed = v.raw; }
                    map.set(id, { type: typeCh, value: parsed });
                    i = v.end;
                    if (payload.charAt(i) === "\n") i++;
                    continue;
                }
                i = k + 2;
                continue;
            }

            var v2 = readJsonValue(payload, k);
            if (v2) {
                var parsed2;
                try { parsed2 = JSON.parse(v2.raw); } catch (e) { parsed2 = v2.raw; }
                map.set(id, { value: parsed2 });
                i = v2.end;
                if (payload.charAt(i) === "\n") i++;
                continue;
            }
            i = k + 1;
        }
        return map;
    }

    function deref(node, map, seen, depth) {
        if (depth > 40) return node;
        if (node == null) return node;
        if (typeof node === "string") {
            var m = /^\$[LSH]?([0-9a-f]+)$/i.exec(node);
            if (!m) return node;
            var key = m[1].toLowerCase();
            if (seen.has(key)) return node;
            var entry = map.get(key);
            if (!entry) return node;
            seen.add(key);
            var out = deref(entry.value, map, seen, depth + 1);
            seen.delete(key);
            return out;
        }
        if (Array.isArray(node)) {
            return node.map(function (x) { return deref(x, map, seen, depth + 1); });
        }
        if (typeof node === "object") {
            var o = {};
            for (var k in node) {
                if (Object.prototype.hasOwnProperty.call(node, k)) {
                    o[k] = deref(node[k], map, seen, depth + 1);
                }
            }
            return o;
        }
        return node;
    }

    function findClip(val) {
        if (!val || typeof val !== "object") return null;
        if (val.clip && typeof val.clip === "object" && val.clip.id) return val.clip;
        if (Array.isArray(val)) {
            for (var i = 0; i < val.length; i++) {
                var r = findClip(val[i]);
                if (r) return r;
            }
        } else {
            for (var k in val) {
                if (!Object.prototype.hasOwnProperty.call(val, k)) continue;
                var r2 = findClip(val[k]);
                if (r2) return r2;
            }
        }
        return null;
    }

    function fallbackFromHtml(html, id) {
        var title = "";
        var handle = "";
        var mt = html.match(/<title>([^<]*)<\/title>/i);
        if (mt) {
            var t = mt[1];
            var h = t.match(/^(.*) by @([^\s|]+)\s*\|\s*Suno$/);
            if (h) {
                title = h[1].trim();
                handle = h[2].trim();
            } else {
                title = t.replace(/\|\s*Suno\s*$/, "").trim();
            }
        }
        return {
            id: id,
            title: title || id,
            handle: handle,
            display_name: handle,
            image_url: "https://cdn2.suno.ai/image_" + id + ".jpeg",
            audio_url: "https://cdn1.suno.ai/" + id + ".mp3",
            video_url: "",
            metadata: { tags: "", prompt: "", duration: null },
            _fallback: true
        };
    }

    function parseHtml(html, id) {
        if (!html) return fallbackFromHtml("", id);
        var payload = collectPayload(html);
        if (!payload) return fallbackFromHtml(html, id);
        var map = parseFlight(payload);
        var resolved = {};
        map.forEach(function (entry, k) {
            resolved[k] = deref(entry.value, map, new Set(), 0);
        });
        var clip = null;
        for (var k in resolved) {
            clip = findClip(resolved[k]);
            if (clip) break;
        }
        if (!clip) return fallbackFromHtml(html, id);
        clip.id = clip.id || id;
        if (!clip.audio_url) clip.audio_url = "https://cdn1.suno.ai/" + clip.id + ".mp3";
        if (!clip.image_url) clip.image_url = "https://cdn2.suno.ai/image_" + clip.id + ".jpeg";
        return clip;
    }

    function normalizeHook(data, hookId) {
        if (!data || typeof data !== "object") return null;
        var clip = data.clip && typeof data.clip === "object" ? data.clip : {};
        var originalId = clip.id || data.original_clip_id || "";
        var videoUrl = typeof data.rendered_video_url === "string" ? data.rendered_video_url : "";
        if (!originalId || !videoUrl || !/^https:\/\//i.test(videoUrl)) return null;

        var normalized = {};
        for (var key in clip) {
            if (Object.prototype.hasOwnProperty.call(clip, key)) normalized[key] = clip[key];
        }
        normalized.id = originalId;
        normalized.title = clip.title || data.title || "Suno hook";
        normalized.audio_url = clip.audio_url || "https://cdn1.suno.ai/" + originalId + ".mp3";
        normalized.video_url = videoUrl;
        normalized.image_url = data.thumbnail_image_url || clip.image_url || "https://cdn2.suno.ai/image_" + originalId + ".jpeg";
        normalized.hook_id = data.id || hookId;
        normalized.hook_duration = data.video_duration != null ? Number(data.video_duration) : null;
        normalized.hook_caption = typeof data.caption === "string" ? data.caption : "";
        normalized._hook = true;
        return normalized;
    }

    async function fetchHookById(hookId, proxy, signal) {
        var px = proxy || DEFAULT_PROXY;
        var url = px + encodeURIComponent(HOOK_API + hookId);
        try {
            var res = await fetch(url, { method: "GET", signal: signal });
            if (!res.ok) return null;
            var data = await res.json();
            return normalizeHook(data, hookId);
        } catch (e) {
            if (e && e.name === "AbortError") throw e;
            return null;
        }
    }

    async function fetchAndParse(id, proxy, signal) {
        var isHook = id.indexOf("h:") === 0;
        var isShort = id.startsWith("s:");
        var px = (proxy || DEFAULT_PROXY);
        if (!/^https?:\/\//i.test(px) &&
    !px.startsWith("/")
) throw new Error("Invalid proxy URL");

        if (isHook) {
            var directHook = await fetchHookById(id.slice(2), px, signal);
            if (!directHook) throw new Error("Could not load public Hook details");
            return directHook;
        }

        var target = isShort
            ? "https://suno.com/s/" + id.slice(2)
            : "https://suno.com/song/" + id;
        var url = px + encodeURIComponent(target);
        var res = await fetch(url, { method: "GET", signal: signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var html = await res.text();
        if (!html || html.length < 400) throw new Error("Empty response from proxy");
        var hookMatch = isShort ? html.match(HOOK_RE) : null;
        var realId = isShort ? (hookMatch ? hookMatch[1] : (html.match(UUID_RE) || [""])[0]).toLowerCase() : id;
        if (isShort && !realId) throw new Error("Could not resolve short link to a song ID");
        // A short song URL also resolves to a UUID, but that UUID is not a Hook ID.
        // Only probe the Hook endpoint when the resolved page explicitly contains
        // a public /hook/<uuid> URL; otherwise parse the song HTML we already have.
        if (isShort && hookMatch) {
            var shortHook = await fetchHookById(realId, px, signal);
            if (shortHook) return shortHook;
        }
        return parseHtml(html, realId);
    }

    // === Playlist parsing (suno.com/playlist/<uuid>) ===
    // Reuses the single-song Flight pipeline (collectPayload / parseFlight / deref),
    // but collects *every* clip object instead of stopping at the first match.

    function findAllClips(val, collected, seen) {
        if (!val || typeof val !== "object") return;
        if (Array.isArray(val)) {
            for (var i = 0; i < val.length; i++) findAllClips(val[i], collected, seen);
            return;
        }
        if (val.clip && typeof val.clip === "object" && val.clip.id) {
            var c = val.clip;
            if (!seen.has(c.id)) { seen.add(c.id); collected.push(c); }
        }
        for (var k in val) {
            if (!Object.prototype.hasOwnProperty.call(val, k)) continue;
            findAllClips(val[k], collected, seen);
        }
    }

    function findPlaylistImage(resolved) {
        var best = null;
        for (var k in resolved) {
            if (!Object.prototype.hasOwnProperty.call(resolved, k)) continue;
            var v = resolved[k];
            if (!v || typeof v !== "object" || Array.isArray(v)) continue;
            var img = v.image_url || v.imageUrl || "";
            if (typeof img !== "string" || !/cdn[12]\.suno\.ai/i.test(img)) continue;
            // Only accept a container that actually holds multiple clips (i.e. the playlist itself).
            var count = 0;
            for (var kk in v) {
                if (v[kk] && typeof v[kk] === "object" && v[kk].clip && v[kk].clip.id) count++;
            }
            if (count >= 2 || (Array.isArray(v.clips) && v.clips.length >= 2)) { best = img; break; }
        }
        return best;
    }

    function findPlaylistName(resolved, html) {
        var name = "";
        var mt = html.match(/<title>([^<]*)<\/title>/i);
        if (mt) name = mt[1].replace(/\s*\|\s*Suno\s*$/i, "").trim();
        if (name) return name;
        for (var k in resolved) {
            if (!Object.prototype.hasOwnProperty.call(resolved, k)) continue;
            var v = resolved[k];
            if (!v || typeof v !== "object" || Array.isArray(v)) continue;
            if (typeof v.name === "string" && v.name) {
                var count = 0;
                for (var kk in v) {
                    if (v[kk] && typeof v[kk] === "object" && v[kk].clip && v[kk].clip.id) count++;
                }
                if (count >= 2 || Array.isArray(v.clips)) return v.name;
            }
            if (typeof v.title === "string" && v.title) {
                var c2 = 0;
                for (var jj in v) {
                    if (v[jj] && typeof v[jj] === "object" && v[jj].clip && v[jj].clip.id) c2++;
                }
                if (c2 >= 2 || Array.isArray(v.clips)) return v.title;
            }
        }
        return name;
    }

    function parsePlaylistHtml(html, id) {
        var payload = collectPayload(html);
        var resolved = {};
        if (payload) {
            var map = parseFlight(payload);
            map.forEach(function (entry, k) {
                resolved[k] = deref(entry.value, map, new Set(), 0);
            });
        }
        var clips = [];
        findAllClips(resolved, clips, new Set());
        clips.forEach(function (c) {
            c.id = c.id || "";
            if (!c.audio_url) c.audio_url = "https://cdn1.suno.ai/" + c.id + ".mp3";
            if (!c.image_url) c.image_url = "https://cdn2.suno.ai/image_" + c.id + ".jpeg";
        });
        var name = findPlaylistName(resolved, html) || ("Playlist " + String(id).substring(0, 8));
        var image = findPlaylistImage(resolved);
        return { clips: clips, name: name, image: image };
    }

    async function fetchAndParsePlaylist(id, proxy, signal) {
        var target = "https://suno.com/playlist/" + id;
        var px = (proxy || DEFAULT_PROXY);
        if (!/^https?:\/\//i.test(px) &&
    !px.startsWith("/")
) throw new Error("Invalid proxy URL");
        var url = px + encodeURIComponent(target);
        var res = await fetch(url, { method: "GET", signal: signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var html = await res.text();
        if (!html || html.length < 400) throw new Error("Empty response from proxy");
        return parsePlaylistHtml(html, id);
    }

    window.SunoParser = {
        DEFAULT_PROXY: DEFAULT_PROXY,
        extractId: extractId,
        parseHtml: parseHtml,
        fetchAndParse: fetchAndParse,
        parsePlaylistHtml: parsePlaylistHtml,
        fetchAndParsePlaylist: fetchAndParsePlaylist
    };
})();

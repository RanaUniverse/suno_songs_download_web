/* global TransformStream, crypto, fetch */
(function (root) {
    "use strict";

    var RIGHTS_URL = window.RANA_CONFIG.RIGHTS_URL;
    var AUDIO_BASE_URL = window.RANA_CONFIG.AUDIO_BASE_URL;
    var CONTENT_TYPE = window.RANA_CONFIG.CONTENT_TYPE;
    var AES_BLOCK_BYTES = window.RANA_CONFIG.AES_BLOCK_BYTES;
    var UUID_RE = window.RANA_CONFIG.UUID_RE;

    function assertSupported() {
        if (!root.crypto || !root.crypto.subtle) {
            throw new Error("This browser does not support Web Crypto audio decryption.");
        }
        if (typeof root.TransformStream !== "function") {
            throw new Error("This browser does not support streaming audio decryption.");
        }
    }

    function normalizeContentId(contentId) {
        var value = String(contentId || "").trim().toLowerCase();
        if (!UUID_RE.test(value)) throw new Error("The Suno song ID is not a valid UUID.");
        return value;
    }

    function base64ToBytes(value) {
        var normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
        while (normalized.length % 4) normalized += "=";
        var binary;
        try {
            binary = root.atob(normalized);
        } catch (error) {
            throw new Error("The audio rights response contains invalid base64 data.");
        }
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    async function getUserKey(glt) {
        if (typeof glt !== "string" || !glt) {
            throw new Error("The audio rights response is missing its guest token.");
        }
        var digest = await root.crypto.subtle.digest("SHA-256", new TextEncoder().encode(glt));
        return root.crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
    }

    async function unwrapBytes(wrappedValue, contentId, userKey, label) {
        var wrapped = base64ToBytes(wrappedValue);
        if (wrapped.byteLength < 28) {
            throw new Error("The wrapped audio " + label + " is incomplete.");
        }
        var raw = await root.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: wrapped.slice(0, 12),
                additionalData: new TextEncoder().encode(contentId)
            },
            userKey,
            wrapped.slice(12)
        );
        return new Uint8Array(raw);
    }

    async function unwrapContentKey(value, contentId, userKey) {
        var rawKey = await unwrapBytes(value, contentId, userKey, "key");
        return root.crypto.subtle.importKey("raw", rawKey, { name: "AES-CTR" }, false, ["decrypt"]);
    }

    async function unwrapContentIv(value, contentId, userKey) {
        var iv = await unwrapBytes(value, contentId, userKey, "IV");
        if (iv.byteLength !== AES_BLOCK_BYTES) {
            throw new Error("The unwrapped audio IV must be 16 bytes.");
        }
        return iv;
    }

    function addCounter(iv, blockOffset) {
        var counter = new Uint8Array(AES_BLOCK_BYTES);
        counter.set(iv);
        var value = BigInt(0);
        for (var i = 0; i < counter.length; i++) {
            value = (value << BigInt(8)) | BigInt(counter[i]);
        }
        value += BigInt(blockOffset);
        for (var j = counter.length - 1; j >= 0; j--) {
            counter[j] = Number(value & BigInt(255));
            value >>= BigInt(8);
        }
        return counter;
    }

    function createDecryptTransform(key, iv) {
        var pending = new Uint8Array(0);
        var blockOffset = 0;

        return new root.TransformStream({
            async transform(chunk, controller) {
                var bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
                var merged = new Uint8Array(pending.byteLength + bytes.byteLength);
                merged.set(pending, 0);
                merged.set(bytes, pending.byteLength);
                var processLength = AES_BLOCK_BYTES * Math.floor(merged.byteLength / AES_BLOCK_BYTES);

                if (processLength > 0) {
                    var encrypted = merged.buffer.slice(merged.byteOffset, merged.byteOffset + processLength);
                    var decrypted = await root.crypto.subtle.decrypt(
                        { name: "AES-CTR", counter: addCounter(iv, blockOffset), length: 128 },
                        key,
                        encrypted
                    );
                    blockOffset += processLength / AES_BLOCK_BYTES;
                    controller.enqueue(new Uint8Array(decrypted));
                }
                pending = merged.slice(processLength);
            },

            async flush(controller) {
                if (!pending.byteLength) return;
                var decrypted = await root.crypto.subtle.decrypt(
                    { name: "AES-CTR", counter: addCounter(iv, blockOffset), length: 128 },
                    key,
                    pending
                );
                controller.enqueue(new Uint8Array(decrypted));
            }
        });
    }

    async function fetchRights(contentId, options) {
        var csrfToken = document.querySelector(
            'meta[name="csrf-token"]'
        ).content;
        console.log(csrfToken)
        var response = await root.fetch((options && options.rightsUrl) || RIGHTS_URL, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken
            },
            body: JSON.stringify({
                content_params: { content_id: contentId, content_type: CONTENT_TYPE }
            }),
            signal: options && options.signal
        });

        if (!response.ok) {
            var detail = await response.text().catch(function () { return ""; });
            throw new Error(
                "Audio authorization failed (HTTP " + response.status + ")" +
                (detail ? ": " + detail.slice(0, 180) : ".")
            );
        }

        var rights;
        try {
            rights = await response.json();
        } catch (error) {
            throw new Error("The audio authorization service returned invalid JSON.");
        }
        if (!rights || !rights.key || !rights.iv || !rights.glt) {
            throw new Error("The audio authorization response is missing key, IV, or guest token data.");
        }
        return rights;
    }

    function encryptedAudioUrl(contentId, options) {
        return ((options && options.audioBaseUrl) || AUDIO_BASE_URL) + encodeURIComponent(contentId) + ".m4a";
    }

    async function fetchEncryptedAudio(contentId, options) {
        var response = await root.fetch(encryptedAudioUrl(contentId, options), {
            method: "GET",
            signal: options && options.signal
        });
        if (!response.ok) throw new Error("Encrypted audio request failed (HTTP " + response.status + ").");
        if (!response.body) throw new Error("This browser did not provide a readable audio stream.");
        return response;
    }

    function detectAudioType(firstChunk) {
        var first = firstChunk || new Uint8Array(0);
        if (first.byteLength >= 4 && first[0] === 0x1a && first[1] === 0x45 && first[2] === 0xdf && first[3] === 0xa3) {
            return { mimeType: "audio/webm", extension: "webm" };
        }
        if (first.byteLength >= 3 && first[0] === 0x49 && first[1] === 0x44 && first[2] === 0x33) {
            return { mimeType: "audio/mpeg", extension: "mp3" };
        }
        if (first.byteLength >= 2 && first[0] === 0xff && (first[1] & 0xe0) === 0xe0) {
            return { mimeType: "audio/mpeg", extension: "mp3" };
        }
        return { mimeType: "audio/mp4", extension: "m4a" };
    }

    async function decryptAudio(contentId, options) {
        assertSupported();
        var id = normalizeContentId(contentId);
        var opts = options || {};
        var rights = await fetchRights(id, opts);
        var userKey = await getUserKey(rights.glt);
        var contentKey = await unwrapContentKey(rights.key, id, userKey);
        var contentIv = await unwrapContentIv(rights.iv, id, userKey);
        var response = await fetchEncryptedAudio(id, opts);
        var totalBytes = Number(response.headers.get("content-length")) || 0;
        var reader = response.body.pipeThrough(createDecryptTransform(contentKey, contentIv)).getReader();
        var chunks = [];
        var bytesDecrypted = 0;

        while (true) {
            var result = await reader.read();
            if (result.done) break;
            if (!result.value) continue;
            chunks.push(result.value);
            bytesDecrypted += result.value.byteLength;
            if (typeof opts.onProgress === "function") {
                opts.onProgress({
                    bytesDecrypted: bytesDecrypted,
                    totalBytes: totalBytes,
                    percent: totalBytes ? Math.min(100, bytesDecrypted / totalBytes * 100) : null
                });
            }
        }

        var type = detectAudioType(chunks[0]);
        return new Blob(chunks, { type: type.mimeType });
    }

    function extensionForBlob(blob) {
        if (blob && blob.type === "audio/webm") return "webm";
        if (blob && blob.type === "audio/mpeg") return "mp3";
        return "m4a";
    }

    root.SunoAudioDecoder = Object.freeze({
        RIGHTS_URL: RIGHTS_URL,
        AUDIO_BASE_URL: AUDIO_BASE_URL,
        decryptAudio: decryptAudio,
        extensionForBlob: extensionForBlob
    });
})(typeof window !== "undefined" ? window : globalThis);
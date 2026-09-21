/* global Blob, fetch */
(function (root) {
    "use strict";

    var WRITER_URL = window.RANA_CONFIG.WRITER_URL;

    var writerPromise = null;

    function ensureWriter() {
        if (typeof root.ID3Writer === "function") return Promise.resolve(root.ID3Writer);
        if (writerPromise) return writerPromise;
        writerPromise = new Promise(function (resolve, reject) {
            var script = root.document.createElement("script");
            script.src = WRITER_URL;
            script.async = true;

            script.onload = function () {
                if (typeof root.ID3Writer === "function") resolve(root.ID3Writer);
                else reject(new Error("MP3 information writer did not load."));
            };
            script.onerror = function () { reject(new Error("MP3 information writer could not be loaded.")); };
            root.document.head.appendChild(script);
        }).catch(function (error) {
            writerPromise = null;
            throw error;
        });
        return writerPromise;
    }

    function cleanLyrics(value) {
        var lyrics = String(value || "").replace(/\r\n?/g, "\n").trim();
        if (/^\[\s*instrumental\s*\]$/i.test(lyrics)) return "";
        return lyrics;
    }

    async function attachMp3Tags(mp3Blob, info, options) {
        if (!mp3Blob || typeof mp3Blob.arrayBuffer !== "function") {
            throw new Error("A valid MP3 file is required before adding information.");
        }

        var details = info || {};
        var opts = options || {};
        var Writer = await ensureWriter();
        var writer = new Writer(await mp3Blob.arrayBuffer());
        var title = String(details.title || "").trim();
        var artist = String(details.artist || "").trim();
        var album = String(details.album || title || "Suno AI").trim();
        var tags = String(details.tags || "").trim();
        var lyrics = cleanLyrics(details.lyrics);
        var coverUrl = String(details.cover || details.coverUrl || "").trim();

        if (title) writer.setFrame("TIT2", title);
        if (artist) {
            writer.setFrame("TPE1", [artist]);
            writer.setFrame("TPE2", [artist]);
            writer.setFrame("TCOM", [artist]);
            writer.setFrame("TEXT", [artist]);
        }
        writer.setFrame("TALB", album || "Suno AI");
        if (tags) writer.setFrame("TCON", [tags]);
        if (lyrics) {
            writer.setFrame("USLT", {
                language: "eng",
                description: "",
                lyrics: lyrics
            });
        }

        if (coverUrl) {
            try {
                var coverResponse = await root.fetch(coverUrl, {
                    mode: "cors",
                    credentials: "omit",
                    signal: opts.signal || undefined
                });
                if (coverResponse.ok) {
                    writer.setFrame("APIC", {
                        type: 3,
                        data: new Uint8Array(await coverResponse.arrayBuffer()),
                        description: ""
                    });
                }
            } catch (error) {
                if (error && error.name === "AbortError") throw error;
                // Cover art is optional; text information can still be embedded.
            }
        }

        writer.addTag();
        var output = writer.getBlob();
        return output && typeof output.arrayBuffer === "function"
            ? output
            : new root.Blob([output], { type: "audio/mpeg" });
    }

    root.SunoAudioInfo = Object.freeze({
        attachMp3Tags: attachMp3Tags,
        cleanLyrics: cleanLyrics
    });
})(typeof window !== "undefined" ? window : globalThis);
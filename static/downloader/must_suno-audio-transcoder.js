/* global window */
(function (root) {
    "use strict";

    var LAME_URL = window.RANA_CONFIG.LAME_URL;
    var OPUS_FALLBACK_URL = "/tools/downloader/suno-opus-mp4-fallback.js?v=999048db6939";
    var lamePromise = null;
    var opusFallbackPromise = null;

    function loadLame() {
        if (root.lamejs && typeof root.lamejs.Mp3Encoder === "function") {
            return Promise.resolve(root.lamejs);
        }
        if (lamePromise) return lamePromise;

        lamePromise = new Promise(function (resolve, reject) {
            var script = root.document.createElement("script");
            script.src = LAME_URL;
            script.async = true;
            script.onload = function () {
                if (root.lamejs && typeof root.lamejs.Mp3Encoder === "function") resolve(root.lamejs);
                else reject(new Error("The MP3 encoder loaded without its browser API."));
            };
            script.onerror = function () { reject(new Error("The MP3 encoder could not be loaded.")); };
            root.document.head.appendChild(script);
        }).catch(function (error) {
            lamePromise = null;
            throw error;
        });
        return lamePromise;
    }

    function abortError() {
        return new DOMException("Audio conversion was cancelled.", "AbortError");
    }

    function containsAscii(bytes, value) {
        for (var i = 0; i <= bytes.length - value.length; i++) {
            var matches = true;
            for (var j = 0; j < value.length; j++) {
                if (bytes[i + j] !== value.charCodeAt(j)) {
                    matches = false;
                    break;
                }
            }
            if (matches) return true;
        }
        return false;
    }

    function isOpusInMp4(input) {
        var bytes = new Uint8Array(input || new ArrayBuffer(0));
        return bytes.length >= 12 &&
            bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 &&
            containsAscii(bytes, "Opus") && containsAscii(bytes, "dOps");
    }

    function loadOpusFallback() {
        if (opusFallbackPromise) return opusFallbackPromise;
        opusFallbackPromise = import(OPUS_FALLBACK_URL).catch(function (error) {
            opusFallbackPromise = null;
            throw error;
        });
        return opusFallbackPromise;
    }

    function pcm16(source, start, length) {
        var output = new Int16Array(length);
        for (var i = 0; i < length; i++) {
            var sample = Math.max(-1, Math.min(1, source[start + i] || 0));
            output[i] = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
        }
        return output;
    }

    function interleavedPcm16(audioBuffer, start, length, channels) {
        var output = new Int16Array(length * channels);
        var left = audioBuffer.getChannelData(0);
        var right = channels > 1 ? audioBuffer.getChannelData(1) : null;
        for (var i = 0; i < length; i++) {
            var leftSample = Math.max(-1, Math.min(1, left[start + i] || 0));
            output[i * channels] = leftSample < 0 ? Math.round(leftSample * 32768) : Math.round(leftSample * 32767);
            if (channels > 1) {
                var rightSample = Math.max(-1, Math.min(1, right[start + i] || 0));
                output[i * channels + 1] = rightSample < 0 ? Math.round(rightSample * 32768) : Math.round(rightSample * 32767);
            }
        }
        return output;
    }

    function writeAscii(view, offset, value) {
        for (var i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    }

    function wavHeader(frames, channels, sampleRate) {
        var bytesPerSample = 2;
        var dataBytes = frames * channels * bytesPerSample;
        if (!Number.isFinite(dataBytes) || dataBytes < 0 || dataBytes > 0xffffffff - 36) {
            throw new Error("This audio is too large to save as a standard WAV file.");
        }
        var header = new ArrayBuffer(44);
        var view = new DataView(header);
        writeAscii(view, 0, "RIFF");
        view.setUint32(4, 36 + dataBytes, true);
        writeAscii(view, 8, "WAVE");
        writeAscii(view, 12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * channels * bytesPerSample, true);
        view.setUint16(32, channels * bytesPerSample, true);
        view.setUint16(34, bytesPerSample * 8, true);
        writeAscii(view, 36, "data");
        view.setUint32(40, dataBytes, true);
        return header;
    }

    function nextFrame() {
        return new Promise(function (resolve) {
            if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(function () { resolve(); });
            else root.setTimeout(resolve, 0);
        });
    }

    async function toMp3(sourceBlob, options) {
        if (!(sourceBlob instanceof Blob) || !sourceBlob.size) {
            throw new Error("The decrypted audio is empty and cannot be converted.");
        }

        var opts = options || {};
        if (opts.signal && opts.signal.aborted) throw abortError();
        var lame = await loadLame();
        var AudioContextClass = root.AudioContext || root.webkitAudioContext;
        if (!AudioContextClass) throw new Error("This browser does not support local audio conversion.");

        var context = new AudioContextClass();
        var audioBuffer;
        var input;
        try {
            input = await sourceBlob.arrayBuffer();
            if (opts.signal && opts.signal.aborted) throw abortError();
            if (opts.forceOpusFallback) {
                var forcedError = new Error("Native decoding skipped by forceOpusFallback test mode.");
                forcedError.name = "EncodingError";
                throw forcedError;
            }
            audioBuffer = await context.decodeAudioData(input.slice(0));
        } catch (error) {
            try { await context.close(); } catch (closeError) { /* Ignore cleanup errors. */ }
            if (error && error.name === "AbortError") throw error;
            var decodeError = new Error("This browser could not decode the source audio for MP3 conversion.");
            decodeError.stage = "decode";
            decodeError.sourceType = sourceBlob.type || "unknown";
            decodeError.sourceBytes = sourceBlob.size;
            decodeError.originalName = error && error.name || "Error";
            decodeError.originalMessage = error && error.message || "No browser error message was provided.";
            if (!isOpusInMp4(input)) throw decodeError;

            try {
                if (typeof opts.onFallback === "function") opts.onFallback({ reason: decodeError });
                var fallback = await loadOpusFallback();
                var fallbackResult = await fallback.toMp3(sourceBlob, {
                    bitrate: opts.bitrate,
                    signal: opts.signal,
                    onStage: function (stage, progress) {
                        if (typeof opts.onProgress !== "function") return;
                        var value = progress && progress.percent;
                        if (stage === "convert") opts.onProgress({ percent: 10 + (Number(value) || 0) * 0.9, fallback: true, stage: stage });
                        else opts.onProgress({ percent: Math.min(10, (Number(value) || 0) / 10), fallback: true, stage: stage });
                    }
                });
                if (typeof opts.onDecoded === "function") {
                    opts.onDecoded({
                        channels: fallbackResult.info.channels,
                        duration: fallbackResult.info.duration,
                        frames: fallbackResult.info.samplesDecoded,
                        sampleRate: fallbackResult.info.sampleRate,
                        fallback: true,
                        codec: fallbackResult.info.codec,
                        opusFrames: fallbackResult.info.frames,
                        samplesDecoded: fallbackResult.info.samplesDecoded,
                        preSkip: fallbackResult.info.preSkip,
                        targetSamples: fallbackResult.info.targetSamples,
                        decodeErrors: fallbackResult.info.decodeErrors,
                        dependencies: fallback.dependencyVersions
                    });
                }
                return fallbackResult.blob;
            } catch (fallbackError) {
                if (fallbackError && fallbackError.name === "AbortError") throw fallbackError;
                fallbackError.nativeDecodeError = decodeError;
                throw fallbackError;
            }
        }

        var channels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
        var sampleRate = audioBuffer.sampleRate;
        if (typeof opts.onDecoded === "function") {
            opts.onDecoded({
                channels: channels,
                duration: audioBuffer.duration,
                frames: audioBuffer.length,
                sampleRate: sampleRate
            });
        }
        var bitrate = Number(opts.bitrate) || 192;
        var encoder = new lame.Mp3Encoder(channels, sampleRate, bitrate);
        var left = audioBuffer.getChannelData(0);
        var right = channels > 1 ? audioBuffer.getChannelData(1) : null;
        var frameSamples = 1152;
        var chunks = [];

        try {
            for (var offset = 0, frame = 0; offset < audioBuffer.length; offset += frameSamples, frame++) {
                if (opts.signal && opts.signal.aborted) throw abortError();
                var length = Math.min(frameSamples, audioBuffer.length - offset);
                var leftPcm = pcm16(left, offset, length);
                var encoded = channels > 1
                    ? encoder.encodeBuffer(leftPcm, pcm16(right, offset, length))
                    : encoder.encodeBuffer(leftPcm);
                if (encoded.length) chunks.push(new Int8Array(encoded));

                if (typeof opts.onProgress === "function") {
                    opts.onProgress({ percent: Math.min(100, (offset + length) / audioBuffer.length * 100) });
                }
                if (frame > 0 && frame % 48 === 0) await nextFrame();
            }

            var tail = encoder.flush();
            if (tail.length) chunks.push(new Int8Array(tail));
        } finally {
            try { await context.close(); } catch (closeError) { /* Ignore cleanup errors. */ }
        }

        if (!chunks.length) throw new Error("The MP3 encoder returned an empty file.");
        return new Blob(chunks, { type: "audio/mpeg" });
    }

    async function toWav(sourceBlob, options) {
        if (!(sourceBlob instanceof Blob) || !sourceBlob.size) {
            throw new Error("The decrypted audio is empty and cannot be converted.");
        }

        var opts = options || {};
        if (opts.signal && opts.signal.aborted) throw abortError();
        var AudioContextClass = root.AudioContext || root.webkitAudioContext;
        if (!AudioContextClass) throw new Error("This browser does not support local audio conversion.");

        var context = new AudioContextClass();
        var audioBuffer;
        var input;
        try {
            input = await sourceBlob.arrayBuffer();
            if (opts.signal && opts.signal.aborted) throw abortError();
            audioBuffer = await context.decodeAudioData(input.slice(0));
        } catch (error) {
            try { await context.close(); } catch (closeError) { /* Ignore cleanup errors. */ }
            if (error && error.name === "AbortError") throw error;
            var decodeError = new Error("This browser could not decode the source audio for WAV conversion.");
            decodeError.stage = "decode";
            decodeError.sourceType = sourceBlob.type || "unknown";
            decodeError.sourceBytes = sourceBlob.size;
            decodeError.originalName = error && error.name || "Error";
            decodeError.originalMessage = error && error.message || "No browser error message was provided.";
            if (!isOpusInMp4(input)) throw decodeError;

            try {
                if (typeof opts.onFallback === "function") opts.onFallback({ reason: decodeError });
                var fallback = await loadOpusFallback();
                var fallbackResult = await fallback.toWav(sourceBlob, {
                    signal: opts.signal,
                    onStage: function (stage, progress) {
                        if (typeof opts.onProgress !== "function") return;
                        var value = progress && progress.percent;
                        if (stage === "convert") opts.onProgress({ percent: 10 + (Number(value) || 0) * 0.9, fallback: true, stage: stage });
                        else opts.onProgress({ percent: Math.min(10, (Number(value) || 0) / 10), fallback: true, stage: stage });
                    }
                });
                if (typeof opts.onDecoded === "function") {
                    opts.onDecoded({
                        channels: fallbackResult.info.channels,
                        duration: fallbackResult.info.duration,
                        frames: fallbackResult.info.samplesDecoded,
                        sampleRate: fallbackResult.info.sampleRate,
                        fallback: true,
                        codec: fallbackResult.info.codec,
                        opusFrames: fallbackResult.info.frames,
                        samplesDecoded: fallbackResult.info.samplesDecoded,
                        preSkip: fallbackResult.info.preSkip,
                        targetSamples: fallbackResult.info.targetSamples,
                        decodeErrors: fallbackResult.info.decodeErrors,
                        dependencies: fallback.dependencyVersions
                    });
                }
                return fallbackResult.blob;
            } catch (fallbackError) {
                if (fallbackError && fallbackError.name === "AbortError") throw fallbackError;
                fallbackError.nativeDecodeError = decodeError;
                throw fallbackError;
            }
        }

        var channels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
        var sampleRate = audioBuffer.sampleRate;
        if (typeof opts.onDecoded === "function") {
            opts.onDecoded({
                channels: channels,
                duration: audioBuffer.duration,
                frames: audioBuffer.length,
                sampleRate: sampleRate
            });
        }

        var chunkFrames = 16384;
        var chunks = [wavHeader(audioBuffer.length, channels, sampleRate)];
        try {
            for (var offset = 0, chunkIndex = 0; offset < audioBuffer.length; offset += chunkFrames, chunkIndex++) {
                if (opts.signal && opts.signal.aborted) throw abortError();
                var length = Math.min(chunkFrames, audioBuffer.length - offset);
                chunks.push(interleavedPcm16(audioBuffer, offset, length, channels));
                if (typeof opts.onProgress === "function") {
                    opts.onProgress({ percent: Math.min(100, (offset + length) / audioBuffer.length * 100) });
                }
                if (chunkIndex > 0 && chunkIndex % 8 === 0) await nextFrame();
            }
        } finally {
            try { await context.close(); } catch (closeError) { /* Ignore cleanup errors. */ }
        }

        return new Blob(chunks, { type: "audio/wav" });
    }

    root.SunoAudioTranscoder = Object.freeze({
        LAME_URL: LAME_URL,
        toMp3: toMp3,
        toWav: toWav
    });
})(typeof window !== "undefined" ? window : globalThis);
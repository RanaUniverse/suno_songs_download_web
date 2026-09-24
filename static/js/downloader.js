function sendSongInfoToFlask(payload) {
    // 🍌 Automatically grab the CSRF token from base.html
    var csrfMeta = document.querySelector('meta[name="csrf-token"]');
    var csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';

    fetch('/api/RanaUniverse/save-song-info', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken // Securely passes Flask-WTF validation
        },
        body: JSON.stringify(payload),
    })
        .then(function (response) {
            var contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
            } else {
                return response.text().then(function (text) {
                    throw new Error("Server returned non-JSON response: " + text);
                });
            }
        })
        .then(function (data) {
            console.log("Server response:", data);
            if (typeof showToast === "function") {
                showToast("🎵 Song info successfully logged to Flask!", "ok");
            }
        })
        .catch(function (error) {
            console.error("Failed to sync song info with Flask:", error);
        });
}




(function () {
    function parseSunoLink(raw) {
        var value = String(raw || "").trim();
        if (/^https\/\//i.test(value))
            value = value.replace(/^https\/\//i, "https://");
        if (/^http\/\//i.test(value))
            value = value.replace(/^http\/\//i, "http://");
        if (/^(?:www\.)?suno\.(?:com|ai)\//i.test(value))
            value = "https://" + value;
        var url;
        try {
            url = new URL(value);
        } catch (e) {
            return null;
        }
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        if (
            url.username ||
            url.password ||
            (url.port && url.port !== "80" && url.port !== "443")
        )
            return null;
        var host = url.hostname.toLowerCase().replace(/\.$/, "");
        if (
            host !== "suno.com" &&
            host !== "www.suno.com" &&
            host !== "suno.ai" &&
            host !== "www.suno.ai"
        )
            return null;
        var path = url.pathname.replace(/\/+$/, "");
        var match = path.match(
            /^\/playlist\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
        );
        if (match)
            return {
                type: "playlist",
                url: "https://suno.com/playlist/" + match[1].toLowerCase(),
            };
        match = path.match(
            /^\/song\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
        );
        if (match)
            return {
                type: "song",
                url: "https://suno.com/song/" + match[1].toLowerCase(),
            };
        match = path.match(/^\/s\/([A-Za-z0-9_-]+)$/);
        if (match) return { type: "song", url: "https://suno.com/s/" + match[1] };
        match = path.match(/^\/@([A-Za-z0-9][A-Za-z0-9_-]{0,63})$/);
        if (match) return { type: "profile", url: "https://suno.com/@" + match[1] };
        return null;
    }

    var form = document.getElementById("dl-form");
    var input = document.getElementById("dl-input");
    var submitBtn = document.getElementById("dl-submit");
    var pasteBtn = document.getElementById("dl-paste");
    var pasteLabel = document.getElementById("dl-paste-label");
    var exampleLink = document.getElementById("dl-example-link");
    var exampleTry = document.getElementById("dl-example-try");
    var statusEl = document.getElementById("dl-status");
    var toastEl = document.getElementById("dl-toast");
    var hero = document.getElementById("dl-hero");
    var coverEl = document.getElementById("dl-cover");
    var titleEl = document.getElementById("dl-title");
    var artistEl = document.getElementById("dl-artist");
    var metaList = document.getElementById("dl-meta-list");
    var detailsDisclosure = document.getElementById("dl-details-disclosure");
    var detailsToggle = document.getElementById("dl-details-toggle");
    var detailsToggleLabel = document.getElementById("dl-details-toggle-label");
    var tagsEl = document.getElementById("dl-tags");
    var openSong = document.getElementById("dl-open-song");
    var previewSec = document.getElementById("dl-preview");
    var audioEl = document.getElementById("dl-audio");
    var audioWrap = audioEl ? audioEl.closest(".dl-audio-wrap") : null;
    var videoEl = document.getElementById("dl-video");
    var videoWrap = document.getElementById("dl-video-wrap");
    var videoMiss = document.getElementById("dl-video-miss");
    var chipMp4 = document.getElementById("dl-chip-mp4");
    var chipLyrics = document.querySelector('.dl-chip[data-kind="lyrics"]');
    var nextStepsModal = document.getElementById("dl-next-steps-modal");
    var nextStepsDialog = document.getElementById("dl-next-steps-dialog");
    var nextStepsClose = document.getElementById("dl-next-steps-close");
    var nextStepsDismiss = document.getElementById("dl-next-steps-dismiss");
    var nextStepsDescription = document.getElementById(
        "dl-next-steps-description",
    );
    var nextCreator = document.getElementById("dl-next-creator");
    var nextLyricMv = document.getElementById("dl-next-lyric-mv");
    var audioFormatModal = document.getElementById("dl-audio-format-modal");
    var audioFormatModalClose = document.getElementById("dl-audio-format-close");
    var audioFormatChoices = audioFormatModal
        ? Array.prototype.slice.call(
            audioFormatModal.querySelectorAll("[data-audio-format-choice]"),
        )
        : [];
    var processingOverlay = document.getElementById("dl-processing");
    var processingTitle = document.getElementById("dl-processing-title");
    var processingStage = document.getElementById("dl-processing-stage");
    var processingTrack = document.getElementById("dl-processing-track");
    var processingBar = document.getElementById("dl-processing-bar");
    var processingDetail = document.getElementById("dl-processing-detail");
    var processingErrorCopy = document.getElementById("dl-processing-error-copy");
    var processingOriginal = document.getElementById("dl-processing-original");
    var processingRetry = document.getElementById("dl-processing-retry");
    var processingCancel = document.getElementById("dl-processing-cancel");
    var dlSection = document.getElementById("dl-download-section");
    var rail = document.getElementById("dl-rail");
    var audioFormatButtons = document.querySelectorAll("[data-audio-format]");

    var ICONS = {
        clock:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        calendar:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/></svg>',
        play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4z"/></svg>',
        heart:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10z"/></svg>',
        check:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    };

    var currentId = "";
    var currentTitle = "";
    var currentArtist = "";
    var currentCreatorHandle = "";
    var currentTags = "";
    var currentLyrics = "";
    var lyricsState = "idle";
    var urls = { mp4: "", cover: "" };
    var decodedAudioId = "";
    var decodedAudioBlob = null;
    var decodedAudioPromise = null;
    var decodedAudioUrl = "";
    var decodedAudioCtrl = null;
    var convertedAudioId = "";
    var convertedAudioFormat = "";
    var convertedAudioBlob = null;
    var convertedAudioPromise = null;
    var selectedAudioChoice = "mp3";
    var pendingAudioAction = null;
    var lastAudioFormatFocus = null;
    var currentProcessingChip = null;
    var lastProcessingFocus = null;
    var metaCtrl = null;
    var lookupSerial = 0;
    var toastTimer = null;
    var nextStepsShownForId = "";
    var nextStepsDownloadType = "unknown";
    var nextStepsReturnFocus = null;
    var btnAll = document.getElementById("dl-btn-all");
    var btnAllLabel = document.getElementById("dl-btn-all-label");
    var playlistModal = document.getElementById("dl-playlist-modal");
    var playlistModalCard = playlistModal
        ? playlistModal.querySelector(".dl-modal-card")
        : null;
    var playlistModalClose = document.getElementById("dl-playlist-modal-close");
    var openPlaylistBtn = document.getElementById("dl-open-playlist");
    var stayOnSongBtn = document.getElementById("dl-stay-song");
    var lastPlaylistModalFocus = null;
    var profileModal = document.getElementById("dl-profile-modal");
    var profileModalClose = document.getElementById("dl-profile-modal-close");
    var openProfileBtn = document.getElementById("dl-open-profile");
    var stayOnSongProfileBtn = document.getElementById("dl-stay-song-profile");
    var lastProfileModalFocus = null;
    var lyricMvModal = document.getElementById("dl-lyric-mv-modal");
    var lyricMvDialog = document.getElementById("dl-lyric-mv-dialog");
    var lyricMvModalClose = document.getElementById("dl-lyric-mv-modal-close");
    var stayLyricMvBtn = document.getElementById("dl-stay-lyric-mv");
    var lastLyricMvModalFocus = null;

    var DL_COVER_PLACEHOLDER = (function () {
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
            "<defs>" +
            '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#1e1e24"/>' +
            '<stop offset="100%" stop-color="#0e0e12"/>' +
            "</linearGradient>" +
            '<radialGradient id="glow" cx="50%" cy="42%" r="55%">' +
            '<stop offset="0%" stop-color="rgba(var(--overlay-rgb), 0.10)"/>' +
            '<stop offset="100%" stop-color="rgba(var(--overlay-rgb), 0)"/>' +
            "</radialGradient>" +
            "</defs>" +
            "<style>" +
            ".s-draw{" +
            "fill:none;" +
            "stroke:rgba(var(--overlay-rgb), 0.55);" +
            "stroke-width:1.6;" +
            "stroke-linecap:round;" +
            "stroke-linejoin:round;" +
            "stroke-dasharray:720;" +
            "stroke-dashoffset:720;" +
            "animation:drawS 3.6s cubic-bezier(0.65,0,0.35,1) infinite;" +
            "}" +
            "@keyframes drawS{" +
            "0%{stroke-dashoffset:720;opacity:0.25}" +
            "35%{stroke-dashoffset:0;opacity:1}" +
            "70%{stroke-dashoffset:0;opacity:1}" +
            "100%{stroke-dashoffset:-720;opacity:0.25}" +
            "}" +
            "</style>" +
            '<rect width="200" height="200" rx="18" fill="url(#bg)"/>' +
            '<rect width="200" height="200" rx="18" fill="url(#glow)"/>' +
            '<rect x="0.75" y="0.75" width="198.5" height="198.5" rx="17.25" fill="none" stroke="rgba(var(--overlay-rgb), 0.06)" stroke-width="1.5"/>' +
            '<text class="s-draw" x="100" y="100" text-anchor="middle" dominant-baseline="central" ' +
            'font-family="Outfit, ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" ' +
            'font-size="150" font-weight="800" letter-spacing="-6">S</text>' +
            "</svg>";
        return "data:image/svg+xml," + encodeURIComponent(svg);
    })();

    function showToast(message, kind) {
        if (!toastEl) return;
        if (toastTimer) window.clearTimeout(toastTimer);
        toastEl.textContent = message || "";
        toastEl.classList.remove("is-error", "is-visible");
        if (kind === "error" || kind === "err") toastEl.classList.add("is-error");
        window.requestAnimationFrame(function () {
            toastEl.classList.add("is-visible");
        });
        toastTimer = window.setTimeout(function () {
            toastEl.classList.remove("is-visible");
            toastTimer = null;
        }, 2800);
    }

    function setStatus(msg, kind) {
        statusEl.textContent = "";
        statusEl.classList.remove("err", "ok");
        if (msg) showToast(msg, kind === "err" ? "error" : "success");
    }

    function requestDownload(action) {
        return Promise.resolve().then(action);
    }

    function normalizeNextStepsDownloadType(value) {
        return ["mp3", "wav", "original", "lyrics", "cover", "mp4", "zip"].indexOf(
            value,
        ) !== -1
            ? value
            : "unknown";
    }

    function normalizeCreatorHandle(value) {
        var handle = String(value || "")
            .trim()
            .replace(/^@/, "");
        return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(handle) ? handle : "";
    }

    function trackNextStepsEvent(name, action, reason) {
        var params = {
            next_step_action: action || "none",
            download_type: nextStepsDownloadType,
            creator_insights_available: currentCreatorHandle ? "yes" : "no",
            style_available: currentTags ? "yes" : "no",
        };
        if (reason) params.dismiss_reason = reason;
        try {
            if (typeof window.gtag === "function") window.gtag("event", name, params);
        } catch (error) {
            /* Analytics must never interrupt the download flow. */
        }
        try {
            if (typeof window.clarity === "function") {
                var clarityName =
                    "downloader_" +
                    name +
                    (action && action !== "none" ? "_" + action : "");
                window.clarity("event", clarityName);
            }
        } catch (error) {
            /* Analytics must never interrupt the download flow. */
        }
    }

    function nextStepsFocusableElements() {
        if (!nextStepsDialog) return [];
        return Array.prototype.filter.call(
            nextStepsDialog.querySelectorAll(
                'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ),
            function (element) {
                return !element.hidden && element.getClientRects().length > 0;
            },
        );
    }

    var nextStepsMobileQuery = window.matchMedia
        ? window.matchMedia("(max-width: 560px)")
        : null;

    function updateNextStepsLyricMvVisibility() {
        var isMobile = nextStepsMobileQuery
            ? nextStepsMobileQuery.matches
            : window.innerWidth <= 560;
        if (nextLyricMv) nextLyricMv.hidden = isMobile;
        if (nextStepsDescription) {
            nextStepsDescription.textContent = isMobile
                ? "Keep working with this song."
                : "Keep working with this song, or turn it into a lyric MV.";
        }
    }

    if (nextStepsMobileQuery) {
        if (nextStepsMobileQuery.addEventListener)
            nextStepsMobileQuery.addEventListener(
                "change",
                updateNextStepsLyricMvVisibility,
            );
        else if (nextStepsMobileQuery.addListener)
            nextStepsMobileQuery.addListener(updateNextStepsLyricMvVisibility);
    }

    function closeNextSteps(restoreFocus, dismissReason) {
        if (!nextStepsModal || nextStepsModal.classList.contains("dl-hidden"))
            return;
        nextStepsModal.classList.add("dl-hidden");
        nextStepsModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("dl-modal-open");
        if (dismissReason)
            trackNextStepsEvent("download_next_steps_dismiss", "none", dismissReason);
        var target = nextStepsReturnFocus;
        nextStepsReturnFocus = null;
        if (
            restoreFocus !== false &&
            target &&
            typeof target.focus === "function" &&
            !target.disabled
        )
            target.focus();
    }

    function showDownloadSuccess(downloadType) {
        if (!nextStepsModal || !nextStepsDialog || !currentId) return;
        if (nextStepsShownForId === currentId) return;
        nextStepsShownForId = currentId;
        nextStepsDownloadType = normalizeNextStepsDownloadType(downloadType);
        nextStepsReturnFocus = document.activeElement;
        nextCreator.hidden = !currentCreatorHandle;
        nextCreator.href = currentCreatorHandle
            ? "/tools/profile-downloader/?profile=" +
            encodeURIComponent(currentCreatorHandle) +
            "&view=insights"
            : "/tools/profile-downloader/";
        nextLyricMv.href = "https://example.com/";
        updateNextStepsLyricMvVisibility();

        nextStepsModal.classList.remove("dl-hidden");
        nextStepsModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("dl-modal-open");
        trackNextStepsEvent("download_next_steps_view", "none");
        window.requestAnimationFrame(function () {
            try {
                nextStepsDialog.focus({ preventScroll: true });
            } catch (error) {
                nextStepsDialog.focus();
            }
        });
    }

    function selectedAudioFormatLabel() {
        return selectedAudioFormat() === "wav" ? "WAV" : "MP3";
    }

    function openProcessing(chip) {
        if (!processingOverlay) return;
        if (toastTimer) {
            window.clearTimeout(toastTimer);
            toastTimer = null;
        }
        if (toastEl) toastEl.classList.remove("is-visible");
        currentProcessingChip = chip || null;
        lastProcessingFocus = chip || document.activeElement;
        processingOverlay.classList.remove("dl-hidden", "is-error");
        processingOverlay.classList.add("is-indeterminate");
        processingOverlay.setAttribute("aria-describedby", "dl-processing-stage");
        var formatLabel = selectedAudioFormatLabel();
        processingTitle.textContent = "Preparing your " + formatLabel;
        processingStage.textContent = "Preparing audio…";
        processingDetail.textContent = "Please keep this page open";
        processingBar.style.width = "0%";
        processingTrack.setAttribute(
            "aria-label",
            formatLabel + " conversion progress",
        );
        processingTrack.removeAttribute("aria-valuenow");
        processingTrack.setAttribute("aria-valuetext", "Preparing audio");
        processingErrorCopy.textContent = "";
        processingOriginal.classList.add("dl-hidden");
        processingRetry.classList.add("dl-hidden");
        processingCancel.textContent = "Cancel";
        document.body.classList.add("dl-modal-open");
        processingCancel.focus();
    }

    function closeProcessing(returnFocus) {
        if (!processingOverlay) return;
        processingOverlay.classList.add("dl-hidden");
        processingOverlay.classList.remove("is-error", "is-indeterminate");
        document.body.classList.remove("dl-modal-open");
        var focusTarget = lastProcessingFocus;
        currentProcessingChip = null;
        lastProcessingFocus = null;
        if (
            returnFocus !== false &&
            focusTarget &&
            typeof focusTarget.focus === "function"
        ) {
            try {
                focusTarget.focus({ preventScroll: true });
            } catch (error) {
                focusTarget.focus();
            }
        }
    }

    function updateProcessing(stage, progress) {
        if (!processingOverlay || processingOverlay.classList.contains("dl-hidden"))
            return;
        var formatLabel = selectedAudioFormatLabel();
        var label =
            stage === "convert"
                ? formatLabel === "WAV"
                    ? "Creating WAV"
                    : "Converting to MP3"
                : stage === "info"
                    ? "Adding song information"
                    : stage === "save"
                        ? "Saving " + formatLabel
                        : "Preparing audio";
        var percent =
            progress && progress.percent != null
                ? Math.max(0, Math.min(100, Math.round(progress.percent)))
                : null;
        processingStage.textContent =
            label + (percent == null ? "…" : " · " + percent + "%");
        processingTrack.setAttribute(
            "aria-valuetext",
            label + (percent == null ? "" : " " + percent + "%"),
        );
        if (percent == null) {
            processingOverlay.classList.add("is-indeterminate");
            processingTrack.removeAttribute("aria-valuenow");
            processingBar.style.width = "42%";
            processingDetail.textContent = "Please keep this page open";
        } else {
            processingOverlay.classList.remove("is-indeterminate");
            processingTrack.setAttribute("aria-valuenow", String(percent));
            processingBar.style.width = percent + "%";
            processingDetail.textContent = percent + "%";
        }
    }

    function showProcessingError(error) {
        if (!processingOverlay) return;
        processingOverlay.classList.remove("is-indeterminate");
        processingOverlay.classList.add("is-error");
        processingOverlay.setAttribute(
            "aria-describedby",
            "dl-processing-error-copy",
        );
        var formatLabel = selectedAudioFormatLabel();
        processingTitle.textContent = formatLabel + " conversion unavailable";
        var extension = decodedAudioBlob
            ? audioExtension(decodedAudioBlob).toUpperCase()
            : "";
        processingErrorCopy.textContent = decodedAudioBlob
            ? "This browser could not convert this track to " +
            formatLabel +
            ". The original " +
            extension +
            " audio is ready to download."
            : "This browser could not prepare the audio. Try again, or close this message and choose Original audio.";
        if (decodedAudioBlob) {
            processingOriginal.textContent = "Download original " + extension;
            processingOriginal.classList.remove("dl-hidden");
        } else {
            processingOriginal.classList.add("dl-hidden");
        }
        processingRetry.textContent = "Try " + formatLabel + " again";
        processingRetry.classList.remove("dl-hidden");
        processingCancel.textContent = "Close";
        processingRetry.focus();
        console.error("[audio conversion] failed", {
            format: selectedAudioFormat(),
            name: (error && error.name) || "Error",
            message: (error && error.message) || "Unknown error",
            sourceType: (decodedAudioBlob && decodedAudioBlob.type) || "unknown",
            sourceBytes: (decodedAudioBlob && decodedAudioBlob.size) || 0,
        });
    }

    function cancelProcessing() {
        if (decodedAudioCtrl) decodedAudioCtrl.abort();
        decodedAudioCtrl = null;
        decodedAudioPromise = null;
        convertedAudioPromise = null;
        if (currentProcessingChip) {
            currentProcessingChip.disabled = false;
            currentProcessingChip.querySelector(".dl-chip-sub").textContent =
                selectedAudioLabel();
        }
        closeProcessing(true);
    }

    var detailsMobileQuery = window.matchMedia
        ? window.matchMedia("(max-width: 560px)")
        : null;

    function isMobileDownloaderLayout() {
        return detailsMobileQuery
            ? detailsMobileQuery.matches
            : window.innerWidth <= 560;
    }

    function setDetailsExpanded(expanded) {
        if (!detailsDisclosure || !detailsToggle) return;
        var isExpanded = Boolean(expanded);
        detailsDisclosure.classList.toggle("is-expanded", isExpanded);
        detailsToggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
        if (detailsToggleLabel)
            detailsToggleLabel.textContent = isExpanded ? "Show less" : "Show more";
    }

    function setDetailsAvailable(available) {
        if (!detailsDisclosure) return;
        detailsDisclosure.classList.toggle("dl-hidden", !available);
        if (available) {
            setDetailsExpanded(!isMobileDownloaderLayout());
        } else {
            detailsDisclosure.classList.remove("is-loading");
            setDetailsExpanded(false);
        }
    }

    if (detailsToggle) {
        detailsToggle.addEventListener("click", function () {
            setDetailsExpanded(!detailsDisclosure.classList.contains("is-expanded"));
        });
    }

    function syncDetailsDisclosureForViewport(event) {
        if (
            !detailsDisclosure ||
            detailsDisclosure.classList.contains("dl-hidden") ||
            detailsDisclosure.classList.contains("is-loading")
        )
            return;
        setDetailsExpanded(!event.matches);
    }

    if (detailsMobileQuery) {
        if (typeof detailsMobileQuery.addEventListener === "function") {
            detailsMobileQuery.addEventListener(
                "change",
                syncDetailsDisclosureForViewport,
            );
        } else if (typeof detailsMobileQuery.addListener === "function") {
            detailsMobileQuery.addListener(syncDetailsDisclosureForViewport);
        }
    }

    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function extractId(raw) {
        if (window.SunoParser) return window.SunoParser.extractId(raw);
        var m = String(raw || "").match(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        );
        return m ? m[0].toLowerCase() : "";
    }

    var PLAYLIST_UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function extractPlaylistInfo(raw) {
        var value = String(raw || "").trim();
        if (!value) return null;

        // Accept common pasted forms such as suno.com/playlist/<uuid> and a missing colon in https//.
        if (/^https\/\//i.test(value))
            value = value.replace(/^https\/\//i, "https://");
        if (/^http\/\//i.test(value))
            value = value.replace(/^http\/\//i, "http://");
        if (/^(?:www\.)?suno\.(?:com|ai)\//i.test(value))
            value = "https://" + value;

        var url;
        try {
            url = new URL(value);
        } catch (e) {
            return null;
        }

        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        if (url.username || url.password) return null;
        if (url.port && url.port !== "443" && url.port !== "80") return null;

        var host = url.hostname.toLowerCase().replace(/\.$/, "");
        if (
            host !== "suno.com" &&
            host !== "www.suno.com" &&
            host !== "suno.ai" &&
            host !== "www.suno.ai"
        )
            return null;

        var match = url.pathname.match(
            /^\/playlist\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i,
        );
        if (!match || !PLAYLIST_UUID_RE.test(match[1])) return null;

        var id = match[1].toLowerCase();
        return {
            id: id,
            url: "https://suno.com/playlist/" + id,
        };
    }

    function closePlaylistModal() {
        if (!playlistModal) return;
        playlistModal.classList.add("dl-hidden");
        document.body.classList.remove("dl-modal-open");
        if (
            lastPlaylistModalFocus &&
            typeof lastPlaylistModalFocus.focus === "function"
        ) {
            lastPlaylistModalFocus.focus();
        } else {
            input.focus();
        }
    }

    function openPlaylistModal(info) {
        if (!playlistModal || !openPlaylistBtn) return;
        lastPlaylistModalFocus = document.activeElement;
        openPlaylistBtn.href = "/playlist/?url=" + encodeURIComponent(info.url);
        playlistModal.classList.remove("dl-hidden");
        document.body.classList.add("dl-modal-open");
        if (playlistModalClose) playlistModalClose.focus();
    }

    function closeProfileModal() {
        if (!profileModal) return;
        profileModal.classList.add("dl-hidden");
        document.body.classList.remove("dl-modal-open");
        if (
            lastProfileModalFocus &&
            typeof lastProfileModalFocus.focus === "function"
        ) {
            lastProfileModalFocus.focus();
        } else {
            input.focus();
        }
    }

    function openProfileModal(info) {
        if (!profileModal || !openProfileBtn) return;
        lastProfileModalFocus = document.activeElement;
        openProfileBtn.href =
            "/tools/profile-downloader/?url=" + encodeURIComponent(info.url);
        profileModal.classList.remove("dl-hidden");
        document.body.classList.add("dl-modal-open");
        if (profileModalClose) profileModalClose.focus();
    }

    function closeLyricMvModal() {
        if (!lyricMvModal) return;
        lyricMvModal.classList.add("dl-hidden");
        lyricMvModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("dl-modal-open");
        if (
            lastLyricMvModalFocus &&
            typeof lastLyricMvModalFocus.focus === "function"
        ) {
            lastLyricMvModalFocus.focus();
        }
        lastLyricMvModalFocus = null;
    }

    function openLyricMvModal() {
        if (!lyricMvModal) return;
        lastLyricMvModalFocus = document.activeElement;
        lyricMvModal.classList.remove("dl-hidden");
        lyricMvModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("dl-modal-open");
        if (lyricMvModalClose) lyricMvModalClose.focus();
    }

    function lyricMvFocusableElements() {
        if (!lyricMvDialog) return [];
        return Array.prototype.filter.call(
            lyricMvDialog.querySelectorAll(
                'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ),
            function (element) {
                return !element.hidden && element.getClientRects().length > 0;
            },
        );
    }

    function closeAudioFormatModal(returnFocus) {
        if (!audioFormatModal) return;
        audioFormatModal.classList.add("dl-hidden");
        document.body.classList.remove("dl-modal-open");
        if (
            returnFocus !== false &&
            lastAudioFormatFocus &&
            typeof lastAudioFormatFocus.focus === "function"
        ) {
            lastAudioFormatFocus.focus();
        }
        lastAudioFormatFocus = null;
    }

    function openAudioFormatModal(action) {
        if (!audioFormatModal) {
            selectedAudioChoice = "mp3";
            if (typeof action === "function") action();
            return;
        }
        pendingAudioAction = action;
        lastAudioFormatFocus = document.activeElement;
        audioFormatModal.classList.remove("dl-hidden");
        document.body.classList.add("dl-modal-open");
        if (audioFormatChoices[0]) audioFormatChoices[0].focus();
    }

    function buildUrls(id) {
        return {
            mp4: "https://cdn1.suno.ai/" + id + ".mp4",
            cover: "https://cdn2.suno.ai/image_" + id + ".jpeg",
        };
    }

    function formatDuration(sec) {
        if (sec == null || isNaN(sec)) return "";
        var s = Math.round(Number(sec));
        return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
    }

    function slugify(s) {
        return String(s || "")
            .toLowerCase()
            .replace(/[\u0000-\u001f\u007f]/g, "")
            .replace(/[^a-z0-9\u00c0-\uffff\s\-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "")
            .substring(0, 48)
            .replace(/^-+|-+$/g, "");
    }

    function filenameFor(kind, id, audioExtension) {
        var ext =
            kind === "cover"
                ? ".jpeg"
                : kind === "lyrics"
                    ? ".txt"
                    : kind === "audio"
                        ? "." + (audioExtension || "m4a")
                        : "." + kind;
        var slug = slugify(currentTitle);
        var name = slug || id;
        return name + " [RanaUniverse@upi]" + ext;
    }

    var INSTRUMENTAL_MARKER = "[Instrumental]";

    function normalizeLyrics(value) {
        return String(value == null ? "" : value)
            .replace(/\r\n?/g, "\n")
            .trim();
    }

    function isInstrumentalPlaceholder(value) {
        var lyrics = normalizeLyrics(value);
        // Match the whole normalized field; a real lyric may mention "instrumental".
        return (
            lyrics.length === INSTRUMENTAL_MARKER.length &&
            lyrics.toLowerCase() === INSTRUMENTAL_MARKER.toLowerCase()
        );
    }

    function setLyricsState(state) {
        lyricsState = state;
        var chip = chipLyrics || rail.querySelector('.dl-chip[data-kind="lyrics"]');
        if (!chip) return;
        var sub = chip.querySelector(".dl-chip-sub");
        chip.classList.remove("is-unavailable");
        chip.disabled = false;
        chip.removeAttribute("aria-disabled");
        chip.title = "Download lyrics";
        if (sub) sub.textContent = "TXT";

        if (state === "instrumental") {
            chip.classList.add("is-unavailable");
            chip.disabled = true;
            chip.setAttribute("aria-disabled", "true");
            chip.title = "This item is instrumental — no lyrics to download";
            if (sub) sub.textContent = "Instrumental";
            return;
        }

        if (state === "none") {
            chip.classList.add("is-unavailable");
            chip.disabled = true;
            chip.setAttribute("aria-disabled", "true");
            chip.title = "This item has no lyrics to download";
            if (sub) sub.textContent = "No lyrics";
        }
    }

    var mp4State = "idle";

    function setMp4State(state) {
        mp4State = state;
        var chip = chipMp4 || rail.querySelector('.dl-chip[data-kind="mp4"]');
        if (!chip) return;
        var sub = chip.querySelector(".dl-chip-sub");
        chip.classList.remove("is-checking", "is-unavailable");
        chip.disabled = false;
        chip.removeAttribute("aria-disabled");

        if (state === "checking") {
            chip.classList.add("is-checking");
            chip.setAttribute("aria-disabled", "true");
            chip.disabled = true;
            chip.title = "Checking whether this song has a video…";
            if (!chip.classList.contains("is-saved")) sub.textContent = "Checking…";
            if (videoMiss) videoMiss.classList.add("dl-hidden");
            return;
        }

        if (state === "ready") {
            chip.title = "Download MP4 video";
            if (!chip.classList.contains("is-saved")) sub.textContent = "MP4";
            if (videoMiss) videoMiss.classList.add("dl-hidden");
            return;
        }

        if (state === "none") {
            chip.classList.add("is-unavailable");
            chip.removeAttribute("aria-disabled");
            chip.title = "No video file — click to make a lyric MV";
            chip.classList.remove("is-saved");
            sub.textContent = "No video file";
            urls.mp4 = "";
            if (videoMiss) videoMiss.classList.remove("dl-hidden");
        }
    }

    function statusWhenReady() {
        if (mp4State === "none") {
            return "Ready — download audio and cover art below (this song has no video).";
        }
        return "Ready — pick a format below.";
    }

    function applyUrls(id, clip) {
        var base = buildUrls(id);
        urls = {
            mp4: (clip && clip.video_url) || "",
            cover: (clip && clip.image_url) || base.cover,
        };
        coverEl.src = urls.cover;
        coverEl.alt = clip && clip.title ? clip.title : "Suno cover";
        hero.style.setProperty("--cover-url", "url('" + urls.cover + "')");

        if (audioWrap) audioWrap.classList.add("dl-hidden");
        previewSec.classList.add("dl-hidden");

        setMp4State("checking");
        videoWrap.classList.add("dl-hidden");
        if (videoMiss) videoMiss.classList.add("dl-hidden");
        function markVideoReady() {
            urls.mp4 = videoEl.currentSrc || videoEl.src || urls.mp4;
            setMp4State(urls.mp4 ? "ready" : "none");
            videoWrap.classList.remove("dl-hidden");
            previewSec.classList.remove("dl-hidden");
            if (urls.mp4) setStatus(statusWhenReady(), "ok");
        }
        videoEl.onloadedmetadata = markVideoReady;
        videoEl.onerror = function () {
            urls.mp4 = "";
            setMp4State("none");
            videoWrap.classList.add("dl-hidden");
            videoEl.removeAttribute("src");
            setStatus(statusWhenReady(), "ok");
        };
        videoEl.poster = urls.cover;
        var probeMp4 = urls.mp4 || base.mp4;
        if (probeMp4) {
            var loadedMp4 = videoEl.currentSrc || videoEl.src;
            if (loadedMp4 === probeMp4 && videoEl.readyState >= 1 && !videoEl.error) {
                markVideoReady();
            } else {
                if (videoEl.src !== probeMp4) videoEl.src = probeMp4;
                videoEl.load();
            }
        } else {
            videoEl.removeAttribute("src");
            setMp4State("none");
            setStatus(statusWhenReady(), "ok");
        }

        dlSection.classList.remove("dl-hidden");
    }

    function resetChips() {
        mp4State = "idle";
        lyricsState = "idle";
        if (videoMiss) videoMiss.classList.add("dl-hidden");
        rail.querySelectorAll(".dl-chip").forEach(function (c) {
            c.classList.remove("is-saved", "is-checking", "is-unavailable");
            c.disabled = false;
            c.removeAttribute("aria-disabled");
            var kind = c.getAttribute("data-kind");
            if (kind === "mp4") {
                c.title = "Download MP4 video";
            }
            if (kind === "lyrics") {
                c.title = "Download lyrics";
            }

            if (kind === "audio" && !c.hasAttribute("data-audio-format")) {
                c.title = "Choose MP3, WAV or original audio";
            }

            var sub = c.querySelector(".dl-chip-sub");

            if (sub) {
                if (kind === "audio" && !c.hasAttribute("data-audio-format")) {
                    sub.textContent = selectedAudioLabel();
                } else if (kind === "mp4") {
                    sub.textContent = "MP4";
                } else if (kind === "lyrics") {
                    sub.textContent = "TXT";
                } else if (kind !== "audio") {
                    sub.textContent = "JPEG";
                }
            }
        });
    }

    function markChipSaved(kind) {
        var chip = rail.querySelector('.dl-chip[data-kind="' + kind + '"]');
        if (!chip) return;
        chip.classList.add("is-saved");
        chip.querySelector(".dl-chip-sub").textContent = "Saved";
        chip.disabled = false;
    }

    function showSkeleton(id) {
        resetDecodedAudio();
        currentCreatorHandle = "";
        hero.classList.add("is-loading");
        hero.classList.remove("dl-hidden");
        titleEl.textContent = "Loading…";
        artistEl.textContent = "";
        metaList.innerHTML = "<li></li><li></li><li></li>";
        tagsEl.innerHTML =
            '<span class="song-hero-tag"></span><span class="song-hero-tag"></span><span class="song-hero-tag"></span>';
        detailsDisclosure.classList.remove("dl-hidden");
        detailsDisclosure.classList.add("is-loading");
        setDetailsExpanded(false);
        openSong.href =
            id.indexOf("h:") === 0
                ? "https://suno.com/hook/" + id.slice(2)
                : id.indexOf("s:") === 0
                    ? "https://suno.com/s/" + id.slice(2)
                    : "https://suno.com/song/" + id;
        coverEl.src = DL_COVER_PLACEHOLDER;
        coverEl.alt = "";
        hero.style.setProperty("--cover-url", "none");
        previewSec.classList.add("dl-hidden");
        dlSection.classList.add("dl-hidden");
        videoEl.pause();
        videoWrap.classList.add("dl-hidden");
        resetChips();
    }

    function render(clip) {
        hero.classList.remove("is-loading");
        currentId = clip.id || currentId;
        currentTitle = clip.title || "";
        titleEl.textContent = clip.title || currentId;
        openSong.href =
            clip._hook && clip.hook_id
                ? "https://suno.com/hook/" + clip.hook_id
                : "https://suno.com/song/" + currentId;
        var display = clip.display_name || clip.handle || "";
        currentArtist = display;
        currentCreatorHandle = normalizeCreatorHandle(clip.handle);
        var rawLyrics = clip.metadata && clip.metadata.prompt;
        var isInstrumental = isInstrumentalPlaceholder(rawLyrics);
        currentLyrics = isInstrumental ? "" : normalizeLyrics(rawLyrics);
        setLyricsState(
            isInstrumental ? "instrumental" : currentLyrics ? "ready" : "none",
        );
        artistEl.innerHTML = display
            ? "by <strong>" + esc(display) + "</strong>"
            : "";

        var duration = formatDuration(
            clip._hook && clip.hook_duration != null
                ? clip.hook_duration
                : clip.metadata && clip.metadata.duration,
        );
        var created = clip.created_at
            ? String(clip.created_at).substring(0, 10)
            : "";
        var plays = clip.play_count;
        var likes = clip.upvote_count;
        var rows = [];
        if (duration) rows.push("<li>" + ICONS.clock + duration + "</li>");
        if (created) rows.push("<li>" + ICONS.calendar + esc(created) + "</li>");
        if (plays != null)
            rows.push("<li>" + ICONS.play + Number(plays).toLocaleString() + "</li>");
        if (likes != null)
            rows.push(
                "<li>" + ICONS.heart + Number(likes).toLocaleString() + "</li>",
            );
        metaList.innerHTML = rows.join("");

        var tags = clip.metadata && clip.metadata.tags;
        currentTags = tags || "";
        if (clip._hook || tags) {
            tagsEl.innerHTML = String(tags)
                .split(/,\s*/)
                .map(function (t) {
                    return t.trim();
                })
                .filter(Boolean)
                .slice(0, 8)
                .map(function (t) {
                    return '<span class="song-hero-tag">' + esc(t) + "</span>";
                })
                .join("");
            if (clip._hook)
                tagsEl.innerHTML =
                    '<span class="song-hero-tag">Public Hook</span>' + tagsEl.innerHTML;
        } else {
            tagsEl.innerHTML = "";
        }
        detailsDisclosure.classList.remove("is-loading");
        setDetailsAvailable(
            Boolean(display || rows.length || tagsEl.children.length),
        );
    }

    function renderFallback(id) {
        hero.classList.remove("is-loading");
        currentTitle = "";
        currentArtist = "";
        currentCreatorHandle = "";
        currentTags = "";
        currentLyrics = "";
        setLyricsState("none");
        titleEl.textContent = "Song " + id.substring(0, 8);
        artistEl.innerHTML =
            '<span style="color:var(--text-dim);">Limited info — files still work</span>';
        metaList.innerHTML = "";
        tagsEl.innerHTML = "";
        detailsDisclosure.classList.remove("is-loading");
        setDetailsAvailable(true);
    }

    async function loadMeta(id) {
        if (!window.SunoParser) {
            renderFallback(id);
            applyUrls(id, null);
            setStatus("Song loader failed to load — refresh the page.", "err");
            return;
        }
        if (metaCtrl) metaCtrl.abort();
        metaCtrl = new AbortController();
        try {
            var clip = await window.SunoParser.fetchAndParse(
                id,
                null,
                metaCtrl.signal,
            );
            if (clip._fallback) {
                renderFallback(id);
                applyUrls(id, clip);
                setStatus("Limited info for this song.", "err");
            } else {
                render(clip);
                applyUrls(id, clip);
                setStatus(statusWhenReady(), "ok");
                showToast("🎵 Song is Ready To Download!", "ok");

                // 🚀 Send song details & image URL to your Flask backend here!
                sendSongInfoToFlask({
                    id: clip.id || id,
                    title: clip.title || "",
                    image_url: clip.image_url || urls.cover || "",
                    artist: clip.display_name || clip.handle || ""
                });

            }
        } catch (err) {
            if (err && err.name === "AbortError") return;
            renderFallback(id);
            applyUrls(id, null);
            setStatus("Couldn't load song details — downloads still work.", "err");
        }
    }

    function scrollToSongCard() {
        var reduceMotion =
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var navHeight = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--nav-h"),
        );
        if (!isFinite(navHeight) || navHeight < 0) navHeight = 60;

        var targetSection = document.getElementById("dl-download-section");
        if (!targetSection) return;

        window.requestAnimationFrame(function () {
            var y =
                targetSection.getBoundingClientRect().top +
                window.pageYOffset -
                (navHeight + 16);
            window.scrollTo({
                top: Math.max(0, Math.round(y)),
                behavior: reduceMotion ? "auto" : "smooth",
            });
        });
    }

    function saveBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 30000);
    }

    function resetDecodedAudio() {
        if (decodedAudioCtrl) decodedAudioCtrl.abort();
        decodedAudioCtrl = null;
        decodedAudioId = "";
        decodedAudioBlob = null;
        decodedAudioPromise = null;
        convertedAudioId = "";
        convertedAudioFormat = "";
        convertedAudioBlob = null;
        convertedAudioPromise = null;
        if (decodedAudioUrl) URL.revokeObjectURL(decodedAudioUrl);
        decodedAudioUrl = "";
        if (audioEl) {
            audioEl.pause();
            audioEl.removeAttribute("src");
            audioEl.load();
        }
        if (audioWrap) audioWrap.classList.add("dl-hidden");
    }

    function showDecodedAudioPreview(blob) {
        if (!audioEl || !blob) return;
        if (decodedAudioUrl) URL.revokeObjectURL(decodedAudioUrl);
        decodedAudioUrl = URL.createObjectURL(blob);
        audioEl.src = decodedAudioUrl;
        audioEl.load();
        if (audioWrap) audioWrap.classList.remove("dl-hidden");
        previewSec.classList.remove("dl-hidden");
    }

    function audioExtension(blob) {
        if (
            window.SunoAudioDecoder &&
            typeof window.SunoAudioDecoder.extensionForBlob === "function"
        ) {
            return window.SunoAudioDecoder.extensionForBlob(blob);
        }
        return blob && blob.type === "audio/webm"
            ? "webm"
            : blob && blob.type === "audio/mpeg"
                ? "mp3"
                : "m4a";
    }

    function selectedAudioFormat() {
        if (selectedAudioChoice === "original") return "original";
        return selectedAudioChoice === "wav" ? "wav" : "mp3";
    }

    function selectedAudioLabel() {
        return "Choose format";
    }

    async function getDecodedAudio(onProgress) {
        if (!currentId || currentId.indexOf(":") !== -1) {
            throw new Error("The song link has not resolved to an audio ID yet.");
        }
        if (
            !window.SunoAudioDecoder ||
            typeof window.SunoAudioDecoder.decryptAudio !== "function"
        ) {
            throw new Error(
                "The browser audio decoder did not load. Refresh the page and try again.",
            );
        }
        if (decodedAudioId === currentId && decodedAudioBlob)
            return decodedAudioBlob;
        if (decodedAudioId === currentId && decodedAudioPromise)
            return decodedAudioPromise;

        var requestId = currentId;
        if (decodedAudioCtrl) decodedAudioCtrl.abort();
        decodedAudioCtrl = new AbortController();
        decodedAudioId = requestId;
        decodedAudioBlob = null;
        var promise = window.SunoAudioDecoder.decryptAudio(requestId, {
            signal: decodedAudioCtrl.signal,
            onProgress: onProgress,
        })
            .then(function (blob) {
                if (currentId !== requestId || decodedAudioId !== requestId) {
                    throw new DOMException(
                        "The selected song changed during download.",
                        "AbortError",
                    );
                }
                decodedAudioBlob = blob;
                showDecodedAudioPreview(blob);
                return blob;
            })
            .finally(function () {
                if (decodedAudioPromise === promise) decodedAudioPromise = null;
            });
        decodedAudioPromise = promise;
        return promise;
    }

    async function getDownloadAudio(onStageProgress) {
        var format = selectedAudioFormat();
        var original = await getDecodedAudio(function (progress) {
            if (typeof onStageProgress === "function")
                onStageProgress("decrypt", progress);
        });
        if (format === "original") {
            return { blob: original, extension: audioExtension(original) };
        }
        if (!decodedAudioCtrl || decodedAudioCtrl.signal.aborted) {
            decodedAudioCtrl = new AbortController();
        }
        var converterName = format === "wav" ? "toWav" : "toMp3";
        if (
            !window.SunoAudioTranscoder ||
            typeof window.SunoAudioTranscoder[converterName] !== "function"
        ) {
            throw new Error(
                "The " +
                format.toUpperCase() +
                " converter did not load. Refresh the page or choose original audio.",
            );
        }
        if (
            convertedAudioId === currentId &&
            convertedAudioFormat === format &&
            convertedAudioBlob
        ) {
            return { blob: convertedAudioBlob, extension: format };
        }
        if (
            !convertedAudioPromise ||
            convertedAudioId !== currentId ||
            convertedAudioFormat !== format
        ) {
            var requestId = currentId;
            convertedAudioId = currentId;
            convertedAudioFormat = format;
            convertedAudioBlob = null;
            var conversion =
                format === "mp3" && original.type === "audio/mpeg"
                    ? Promise.resolve(original)
                    : window.SunoAudioTranscoder[converterName](original, {
                        bitrate: 192,
                        signal: decodedAudioCtrl && decodedAudioCtrl.signal,
                        onProgress: function (progress) {
                            if (typeof onStageProgress === "function")
                                onStageProgress("convert", progress);
                        },
                    });
            var conversionPromise;
            conversionPromise = conversion
                .then(async function (blob) {
                    if (format === "wav") {
                        if (
                            currentId === requestId &&
                            convertedAudioId === requestId &&
                            convertedAudioFormat === format
                        ) {
                            convertedAudioBlob = blob;
                        }
                        return blob;
                    }
                    if (
                        !window.SunoAudioInfo ||
                        typeof window.SunoAudioInfo.attachMp3Tags !== "function"
                    ) {
                        throw new Error(
                            "The MP3 information module did not load. Refresh the page or choose original audio.",
                        );
                    }
                    if (typeof onStageProgress === "function")
                        onStageProgress("info", { percent: null });
                    var taggedBlob = await window.SunoAudioInfo.attachMp3Tags(
                        blob,
                        {
                            title: currentTitle || currentId,
                            artist: currentArtist,
                            album: currentTitle || "Suno AI",
                            tags: currentTags,
                            lyrics: currentLyrics,
                            cover: urls.cover,
                        },
                        {
                            signal: decodedAudioCtrl && decodedAudioCtrl.signal,
                        },
                    );
                    if (
                        currentId === requestId &&
                        convertedAudioId === requestId &&
                        convertedAudioFormat === format
                    ) {
                        convertedAudioBlob = taggedBlob;
                    }
                    return taggedBlob;
                })
                .finally(function () {
                    if (convertedAudioPromise === conversionPromise)
                        convertedAudioPromise = null;
                });
            convertedAudioPromise = conversionPromise;
        }
        return { blob: await convertedAudioPromise, extension: format };
    }

    /* === Lazy-loaded ZIP library (only fetched when needed) === */
    var JSZIP_URL =
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    var jszipPromise = null;
    function ensureJSZip() {
        if (typeof JSZip !== "undefined") return Promise.resolve(JSZip);
        if (jszipPromise) return jszipPromise;
        jszipPromise = new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = JSZIP_URL;
            s.onload = function () {
                typeof JSZip !== "undefined"
                    ? resolve(JSZip)
                    : reject(new Error("JSZip not defined"));
            };
            s.onerror = function () {
                reject(new Error("JSZip load failed"));
            };
            document.head.appendChild(s);
        });
        return jszipPromise;
    }

    var LABELS = {
        audio: "audio",
        mp4: "video",
        cover: "cover art",
        lyrics: "lyrics",
    };
    var SUB_DEFAULT = { audio: "MP3", mp4: "MP4", cover: "JPEG", lyrics: "TXT" };

    async function downloadAsset(chip, confirmed) {
        var kind = chip.getAttribute("data-kind");
        if (!currentId) return;

        // Lyrics has no remote URL — handled inline from currentLyrics.
        if (kind === "lyrics") {
            if (lyricsState === "instrumental") {
                setStatus(
                    "This item is instrumental — there are no lyrics to download.",
                    "err",
                );
                return;
            }
            if (!currentLyrics) {
                setStatus("This item has no lyrics to download.", "err");
                return;
            }
            if (!confirmed) {
                return requestDownload(function () {
                    return downloadAsset(chip, true);
                });
            }
            chip.disabled = true;
            chip.querySelector(".dl-chip-sub").textContent = "Saving…";
            setStatus("Saving " + LABELS.lyrics + "…");
            try {
                var txtBlob = new Blob([currentLyrics], {
                    type: "text/plain;charset=utf-8",
                });
                saveBlob(txtBlob, filenameFor("lyrics", currentId));
                markChipSaved("lyrics");
                setStatus("Saved " + LABELS.lyrics + ".", "ok");
                showDownloadSuccess("lyrics");
            } catch (err) {
                chip.disabled = false;
                chip.querySelector(".dl-chip-sub").textContent = "TXT";
                setStatus("Couldn't save lyrics.", "err");
            }
            return;
        }

        if (kind === "audio") {
            if (!confirmed) {
                return requestDownload(function () {
                    return downloadAsset(chip, true);
                });
            }
            chip.disabled = true;
            chip.querySelector(".dl-chip-sub").textContent = "Preparing…";
            var requestedAudioFormat = selectedAudioFormat();
            if (requestedAudioFormat !== "original") {
                openProcessing(chip);
            } else {
                setStatus("Preparing audio in your browser…");
            }
            try {
                var output = await getDownloadAudio(function (stage, progress) {
                    var verb =
                        stage === "convert"
                            ? requestedAudioFormat === "wav"
                                ? "Creating WAV"
                                : "Converting"
                            : stage === "info"
                                ? "Adding info"
                                : "Decrypting";
                    chip.querySelector(".dl-chip-sub").textContent =
                        progress.percent == null
                            ? verb + "…"
                            : verb + " " + Math.round(progress.percent) + "%";
                    updateProcessing(stage, progress);
                });
                if (requestedAudioFormat !== "original")
                    updateProcessing("save", { percent: 100 });
                saveBlob(
                    output.blob,
                    filenameFor("audio", currentId, output.extension),
                );
                if (requestedAudioFormat !== "original") closeProcessing(false);
                markChipSaved("audio");
                setStatus("Saved " + output.extension.toUpperCase() + " audio.", "ok");
                showDownloadSuccess(requestedAudioFormat);
            } catch (err) {
                chip.disabled = false;
                chip.querySelector(".dl-chip-sub").textContent = selectedAudioLabel();
                if (err && err.name === "AbortError") {
                    closeProcessing(false);
                    return;
                }
                if (requestedAudioFormat !== "original") {
                    showProcessingError(err);
                } else {
                    console.error("[audio decrypt] failed:", err);
                    setStatus(
                        err && err.message
                            ? err.message
                            : "Couldn't decrypt and save the audio.",
                        "err",
                    );
                }
            }
            return;
        }

        var url = urls[kind];
        if (!url || (kind === "mp4" && mp4State === "none")) {
            if (kind === "mp4") {
                openLyricMvModal();
            }
            return;
        }
        if (!confirmed) {
            return requestDownload(function () {
                return downloadAsset(chip, true);
            });
        }
        chip.disabled = true;
        chip.querySelector(".dl-chip-sub").textContent = "Saving…";
        setStatus("Saving " + LABELS[kind] + "…");
        try {
            var res = await fetch(url, { mode: "cors" });
            if (!res.ok) throw new Error("HTTP " + res.status);

            var blob = await res.blob();
            saveBlob(blob, filenameFor(kind, currentId));
            markChipSaved(kind);
            setStatus("Saved " + LABELS[kind] + ".", "ok");
            showDownloadSuccess(kind);
        } catch (err) {
            chip.disabled = false;
            chip.querySelector(".dl-chip-sub").textContent = SUB_DEFAULT[kind];
            if (kind === "mp4") {
                urls.mp4 = "";
                setMp4State("none");
                setStatus(
                    "This item has no video — download the audio or cover art instead.",
                    "err",
                );
                return;
            }
            setStatus(
                "Opened " + LABELS[kind] + " in a new tab — right-click to save.",
                "err",
            );
            window.open(url, "_blank", "noopener");
        }
    }

    /* Download all available assets as a single zip. Audio is decrypted locally. */
    async function downloadAll(confirmed) {
        if (!currentId) {
            setStatus("Paste a Suno link first.", "err");
            return;
        }
        if (btnAll.disabled) return;
        if (!confirmed) {
            return requestDownload(function () {
                return downloadAll(true);
            });
        }
        btnAll.disabled = true;
        btnAll.classList.remove("is-saved");
        var origLabel = btnAllLabel.textContent;
        btnAllLabel.textContent = "Packaging…";
        setStatus("Packaging files…");
        try {
            var JSZip = await ensureJSZip();
            var zip = new JSZip();
            var name = slugify(currentTitle) || currentId;
            var added = 0;

            // 1) Browser-decrypted audio
            try {
                var output = await getDownloadAudio(function (stage, progress) {
                    var verb =
                        stage === "convert"
                            ? "Converting"
                            : stage === "info"
                                ? "Adding info"
                                : "Decrypting";
                    btnAllLabel.textContent =
                        progress.percent == null
                            ? verb + " audio…"
                            : verb + " audio " + Math.round(progress.percent) + "%";
                });
                zip.file(name + "." + output.extension, output.blob);
                added++;
                btnAllLabel.textContent = "Packaging…";
            } catch (audioError) {
                console.error("[zip audio decrypt] failed:", audioError);
                throw audioError;
            }

            // 2) Cover art (separate jpeg)
            if (urls.cover) {
                try {
                    var covRes = await fetch(urls.cover, { mode: "cors" });
                    if (covRes.ok) {
                        var covBlob = await covRes.blob();
                        zip.file(name + ".jpeg", covBlob);
                        added++;
                    }
                } catch (e) {
                    /* skip */
                }
            }

            // 3) Lyrics txt
            if (currentLyrics) {
                zip.file(name + ".txt", currentLyrics);
                added++;
            }

            // 4) MP4 if available
            if (urls.mp4 && mp4State !== "none") {
                try {
                    var mp4Res = await fetch(urls.mp4, { mode: "cors" });
                    if (mp4Res.ok) {
                        var mp4Blob = await mp4Res.blob();
                        zip.file(name + ".mp4", mp4Blob);
                        added++;
                    }
                } catch (e) {
                    /* skip */
                }
            }

            if (added === 0) throw new Error("nothing to download");

            var zipBlob = await zip.generateAsync({ type: "blob" });
            saveBlob(
                zipBlob,
                (slugify(currentTitle) || currentId) + " [RanaUniverse@upi].zip",
            );
            btnAll.classList.add("is-saved");
            btnAllLabel.textContent = "Saved";
            setStatus("Saved " + added + " file(s) as a zip.", "ok");
            showDownloadSuccess("zip");
            setTimeout(function () {
                btnAll.classList.remove("is-saved");
                btnAllLabel.textContent = origLabel;
                btnAll.disabled = false;
            }, 2500);
        } catch (err) {
            btnAllLabel.textContent = origLabel;
            btnAll.disabled = false;
            setStatus(
                "Couldn't build the zip — try downloading files one by one.",
                "err",
            );
        }
    }

    var pasteSubmitPending = false;
    var lookupInProgress = false;

    function trackPasteEvent(name) {
        try {
            if (typeof window.clarity === "function")
                window.clarity("event", "downloader_" + name);
        } catch (error) {
            /* Analytics must never interrupt the paste flow. */
        }
    }

    function submitPastedLink() {
        pasteSubmitPending = true;
        if (form.requestSubmit) form.requestSubmit();
        else submitBtn.click();
    }

    function setLookupLoading(loading) {
        lookupInProgress = Boolean(loading);
        form.classList.toggle("is-loading", lookupInProgress);
        form.setAttribute("aria-busy", lookupInProgress ? "true" : "false");
        submitBtn.disabled = lookupInProgress;
        submitBtn.classList.toggle("is-loading", lookupInProgress);
        submitBtn.setAttribute(
            "aria-label",
            lookupInProgress ? "Loading song" : "Find download options",
        );
        input.disabled = lookupInProgress;
        if (pasteBtn) pasteBtn.disabled = lookupInProgress;
        if (exampleTry) exampleTry.disabled = lookupInProgress;
        var label = lookupInProgress ? "Loading…" : "Download Song Again";
        var compactLabel = lookupInProgress ? "Loading…" : "Download Song Again";
        var wideLabelEl = submitBtn.querySelector(".dl-submit-label-wide");
        var compactLabelEl = submitBtn.querySelector(".dl-submit-label-compact");
        if (wideLabelEl) wideLabelEl.textContent = label;
        if (compactLabelEl) compactLabelEl.textContent = compactLabel;
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (lookupInProgress) return;
        var shouldScrollToResult = e.isTrusted || pasteSubmitPending;
        pasteSubmitPending = false;
        var routedLink = parseSunoLink(input.value);
        if (routedLink && routedLink.type === "profile") {
            setStatus(
                "Profile link detected — open the profile downloader below.",
                "ok",
            );
            openProfileModal(routedLink);
            return;
        }
        if (routedLink && routedLink.type === "playlist") {
            setStatus(
                "Playlist link detected — open the playlist downloader below.",
                "ok",
            );
            openPlaylistModal(routedLink);
            return;
        }
        var playlistInfo = extractPlaylistInfo(input.value);
        if (playlistInfo) {
            setStatus(
                "Playlist link detected — open the playlist downloader below.",
                "ok",
            );
            openPlaylistModal(playlistInfo);
            return;
        }
        var id = extractId(input.value);
        if (!id) {
            setStatus(
                "That doesn't look like a Suno song or Hook link — try copying it again.",
                "err",
            );
            return;
        }
        currentId = id;
        currentTitle = "";
        var lookupToken = ++lookupSerial;
        setLookupLoading(true);
        showSkeleton(id);
        setStatus(
            id.indexOf("h:") === 0 ? "Looking up Suno Hook…" : "Looking up song…",
        );
        loadMeta(id)
            .then(function () {
                if (
                    shouldScrollToResult &&
                    lookupToken === lookupSerial &&
                    !hero.classList.contains("dl-hidden")
                ) {
                    // i will want to change this to the songs list of download
                    scrollToSongCard();
                }
            })
            .finally(function () {
                if (lookupToken === lookupSerial) setLookupLoading(false);
            });
    });

    input.addEventListener("paste", function (event) {
        if (!isMobileDownloaderLayout()) return;
        var clipboardData = event.clipboardData;
        var pastedText =
            clipboardData && typeof clipboardData.getData === "function"
                ? String(clipboardData.getData("text/plain") || "").trim()
                : "";
        if (!pastedText) {
            trackPasteEvent("native_paste_empty");
            return;
        }
        if (!parseSunoLink(pastedText) && !extractId(pastedText)) {
            trackPasteEvent("native_paste_unrecognized");
            return;
        }

        event.preventDefault();
        input.value = pastedText;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.setSelectionRange(input.value.length, input.value.length);
        trackPasteEvent("native_paste_success");
        window.setTimeout(function () {
            if (!lookupInProgress && input.value.trim() === pastedText)
                submitPastedLink();
        }, 0);
    });

    if (pasteBtn)
        pasteBtn.addEventListener("click", async function () {
            trackPasteEvent("button_click");
            if (
                !navigator.clipboard ||
                typeof navigator.clipboard.readText !== "function" ||
                !window.isSecureContext
            ) {
                trackPasteEvent("button_unavailable");
                input.focus();
                setStatus("Press and hold in the box, then choose Paste.");
                return;
            }
            try {
                var clipboardText = String(
                    (await navigator.clipboard.readText()) || "",
                ).trim();
                if (!clipboardText) {
                    trackPasteEvent("button_empty");
                    input.focus();
                    setStatus("Your clipboard is empty.", "err");
                    return;
                }
                input.value = clipboardText;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
                trackPasteEvent("button_success");
                if (pasteLabel) pasteLabel.textContent = "Pasted";
                window.setTimeout(function () {
                    if (pasteLabel) pasteLabel.textContent = "Paste";
                }, 1600);
                if (isMobileDownloaderLayout()) {
                    submitPastedLink();
                } else {
                    setStatus("Link pasted. Select Download to continue.", "ok");
                }
            } catch (error) {
                trackPasteEvent("button_blocked");
                input.focus();
                setStatus(
                    "Clipboard access was blocked. Press and hold in the box to paste.",
                    "err",
                );
            }
        });


    // if (exampleTry && exampleLink)
    //     exampleTry.addEventListener("click", function () {
    //         input.value = exampleLink.href;
    //         if (form.requestSubmit) form.requestSubmit();
    //         else submitBtn.click();
    //     });


    if (exampleTry && exampleLink) {
        exampleTry.addEventListener("click", function () {
            // Get the demo links array 
            var demoLinks = (window.RANA_CONFIG && window.RANA_CONFIG.DEMO_SONGS_LINKS) || [exampleLink.href];

            // Pick a random link from the list
            var randomIndex = Math.floor(Math.random() * demoLinks.length);
            var chosenUrl = demoLinks[randomIndex];

            // Populate the input and update the example link UI
            input.value = chosenUrl;
            exampleLink.href = chosenUrl;
            exampleLink.textContent = chosenUrl;

            if (form.requestSubmit) form.requestSubmit();
            else submitBtn.click();
        });
    }





    if (playlistModal) {
        playlistModal.addEventListener("click", function (e) {
            if (e.target === playlistModal) closePlaylistModal();
        });
    }
    if (playlistModalClose)
        playlistModalClose.addEventListener("click", closePlaylistModal);
    if (stayOnSongBtn)
        stayOnSongBtn.addEventListener("click", closePlaylistModal);
    if (profileModal)
        profileModal.addEventListener("click", function (e) {
            if (e.target === profileModal) closeProfileModal();
        });
    if (profileModalClose)
        profileModalClose.addEventListener("click", closeProfileModal);
    if (stayOnSongProfileBtn)
        stayOnSongProfileBtn.addEventListener("click", closeProfileModal);
    if (nextStepsModal)
        nextStepsModal.addEventListener("click", function (event) {
            if (event.target === nextStepsModal) closeNextSteps(true, "backdrop");
        });
    if (nextStepsClose)
        nextStepsClose.addEventListener("click", function () {
            closeNextSteps(true, "close_button");
        });
    if (nextStepsDismiss)
        nextStepsDismiss.addEventListener("click", function () {
            closeNextSteps(true, "not_now");
        });
    [nextCreator, nextLyricMv].forEach(function (link) {
        if (!link) return;
        link.addEventListener("click", function () {
            trackNextStepsEvent(
                "download_next_steps_click",
                link.getAttribute("data-next-step-action"),
            );
        });
    });
    if (lyricMvModal)
        lyricMvModal.addEventListener("click", function (event) {
            if (event.target === lyricMvModal) closeLyricMvModal();
        });
    if (lyricMvModalClose)
        lyricMvModalClose.addEventListener("click", closeLyricMvModal);
    if (stayLyricMvBtn)
        stayLyricMvBtn.addEventListener("click", closeLyricMvModal);
    if (audioFormatModal)
        audioFormatModal.addEventListener("click", function (e) {
            if (e.target === audioFormatModal) {
                pendingAudioAction = null;
                closeAudioFormatModal(true);
            }
        });
    if (audioFormatModalClose)
        audioFormatModalClose.addEventListener("click", function () {
            pendingAudioAction = null;
            closeAudioFormatModal(true);
        });
    audioFormatChoices.forEach(function (choice) {
        choice.addEventListener("click", function () {
            var action = pendingAudioAction;
            var returnTarget = lastAudioFormatFocus;
            var formatChoice = choice.getAttribute("data-audio-format-choice");
            selectedAudioChoice =
                formatChoice === "wav" || formatChoice === "original"
                    ? formatChoice
                    : "mp3";
            pendingAudioAction = null;
            closeAudioFormatModal(false);
            if (returnTarget && typeof returnTarget.focus === "function") {
                try {
                    returnTarget.focus({ preventScroll: true });
                } catch (error) {
                    returnTarget.focus();
                }
            }
            if (typeof action === "function") action();
        });
    });
    if (processingCancel)
        processingCancel.addEventListener("click", cancelProcessing);
    if (processingRetry)
        processingRetry.addEventListener("click", function () {
            var chip = currentProcessingChip;
            closeProcessing(false);
            if (!chip) return;
            chip.disabled = false;
            downloadAsset(chip, true);
        });
    if (processingOriginal)
        processingOriginal.addEventListener("click", function () {
            if (!decodedAudioBlob || !currentId) return;
            var extension = audioExtension(decodedAudioBlob);
            saveBlob(decodedAudioBlob, filenameFor("audio", currentId, extension));
            markChipSaved("audio");
            closeProcessing(false);
            setStatus("Saved original " + extension.toUpperCase() + " audio.", "ok");
            showDownloadSuccess("original");
        });
    document.addEventListener("keydown", function (e) {
        if (nextStepsModal && !nextStepsModal.classList.contains("dl-hidden")) {
            if (e.key === "Escape") {
                e.preventDefault();
                closeNextSteps(true, "escape");
                return;
            }
            if (e.key === "Tab") {
                var nextFocusable = nextStepsFocusableElements();
                if (!nextFocusable.length) {
                    e.preventDefault();
                    nextStepsDialog.focus();
                    return;
                }
                var nextFirst = nextFocusable[0];
                var nextLast = nextFocusable[nextFocusable.length - 1];
                if (
                    e.shiftKey &&
                    (document.activeElement === nextFirst ||
                        !nextStepsDialog.contains(document.activeElement))
                ) {
                    e.preventDefault();
                    nextLast.focus();
                } else if (!e.shiftKey && document.activeElement === nextLast) {
                    e.preventDefault();
                    nextFirst.focus();
                }
                return;
            }
        }
        if (lyricMvModal && !lyricMvModal.classList.contains("dl-hidden")) {
            if (e.key === "Escape") {
                e.preventDefault();
                closeLyricMvModal();
                return;
            }
            if (e.key === "Tab") {
                var lyricMvFocusable = lyricMvFocusableElements();
                if (!lyricMvFocusable.length) {
                    e.preventDefault();
                    lyricMvDialog.focus();
                    return;
                }
                var lyricMvFirst = lyricMvFocusable[0];
                var lyricMvLast = lyricMvFocusable[lyricMvFocusable.length - 1];
                if (
                    e.shiftKey &&
                    (document.activeElement === lyricMvFirst ||
                        !lyricMvDialog.contains(document.activeElement))
                ) {
                    e.preventDefault();
                    lyricMvLast.focus();
                } else if (!e.shiftKey && document.activeElement === lyricMvLast) {
                    e.preventDefault();
                    lyricMvFirst.focus();
                }
                return;
            }
        }
        if (
            e.key === "Tab" &&
            processingOverlay &&
            !processingOverlay.classList.contains("dl-hidden")
        ) {
            var processingButtons = [
                processingOriginal,
                processingRetry,
                processingCancel,
            ].filter(function (button) {
                return (
                    button && !button.disabled && !button.classList.contains("dl-hidden")
                );
            });
            if (processingButtons.length) {
                var firstButton = processingButtons[0];
                var lastButton = processingButtons[processingButtons.length - 1];
                if (e.shiftKey && document.activeElement === firstButton) {
                    e.preventDefault();
                    lastButton.focus();
                } else if (!e.shiftKey && document.activeElement === lastButton) {
                    e.preventDefault();
                    firstButton.focus();
                }
            }
        }
        if (
            e.key === "Escape" &&
            processingOverlay &&
            !processingOverlay.classList.contains("dl-hidden")
        ) {
            cancelProcessing();
            return;
        }
        if (
            e.key === "Escape" &&
            playlistModal &&
            !playlistModal.classList.contains("dl-hidden")
        ) {
            closePlaylistModal();
        }
        if (
            e.key === "Escape" &&
            profileModal &&
            !profileModal.classList.contains("dl-hidden")
        ) {
            closeProfileModal();
        }
        if (
            e.key === "Escape" &&
            audioFormatModal &&
            !audioFormatModal.classList.contains("dl-hidden")
        ) {
            pendingAudioAction = null;
            closeAudioFormatModal(true);
        }
    });

    rail.addEventListener("click", function (e) {
        var chip = e.target.closest(".dl-chip");
        if (!chip) return;
        if (chip.classList.contains("is-unavailable")) {
            if (chip.getAttribute("data-kind") === "mp4" && mp4State === "none") {
                openLyricMvModal();
                return;
            }
            setStatus(
                chip.title || "This option is not available for this song.",
                "err",
            );
            return;
        }

        if (chip.getAttribute("data-kind") === "audio") {
            if (chip.disabled) return;

            var format = chip.getAttribute("data-audio-format");

            if (format === "original" || format === "mp3" || format === "wav") {
                selectedAudioChoice = format;
                downloadAsset(chip, false);
            }

            return;
        }

        if (!chip.disabled) downloadAsset(chip, false);
    });

    if (btnAll)
        btnAll.addEventListener("click", function () {
            if (!btnAll.disabled)
                openAudioFormatModal(function () {
                    downloadAll(false);
                });
        });

    // var urlParam =
    //     new URLSearchParams(location.search).get("url") ||
    //     new URLSearchParams(location.search).get("id");
    // if (urlParam) {
    //     input.value = urlParam;
    //     if (submitBtn) submitBtn.click();
    // }

    // Upper was automatically take the url form the url bar i dont want this

    // i will get the link from the hidden tag from my html
    var autoLinkInput = document.getElementById("auto-song-download-link");
    var autoTimeInput = document.getElementById("auto-song-download-time");
    var autoSongTypeInput = document.getElementById("auto-song-download-type");

    // If the hidden auto-download link exists and has a value, use it
    // Later i will want to have later = press the download button by me
    if (autoLinkInput && autoLinkInput.value.trim()) {
        input.value = autoLinkInput.value.trim();

        var actionValue = autoTimeInput ? autoTimeInput.value.trim().toLowerCase() : "";
        console.log("🔍 Auto-download action time/mode detected:", actionValue);

        if (actionValue === "now") {
            console.log("⚡ Mode is 'now': Submitting instantly and then song will download...");

            setTimeout(function () {
                if (form.requestSubmit) {
                    form.requestSubmit();
                } else {
                    submitBtn.click();
                }
            }, 0);

        } else if (actionValue === "later") {
            console.log("⏳ Mode is 'later': Waiting before submitting and user will need to select...");

            setTimeout(function () {
                if (form.requestSubmit) {
                    form.requestSubmit();
                } else {
                    submitBtn.click();
                }
            }, 500);

        } else {
            console.log("📌 Default mode: No explicit action matched, running standard 1-second delay.");

            setTimeout(function () {
                if (form.requestSubmit) {
                    form.requestSubmit();
                } else {
                    submitBtn.click();
                }
            }, 1000);
        }
    }



    // Clean up and read the action value (e.g., "now" or "later")
    var actionValue = autoTimeInput ? autoTimeInput.value.trim().toLowerCase() : "";
    var songFormat = autoSongTypeInput ? autoSongTypeInput.value.trim().toLowerCase() : "original";
    // Security check: ensure it matches one of your actual button types
    if (["original", "mp3", "wav"].indexOf(songFormat) === -1) {
        songFormat = "original";
    }

    if (dlSection && actionValue === "now") {
        var observer = new MutationObserver(function (mutations, obs) {
            // Check when the section is no longer hidden (meaning the song options are loaded)
            if (!dlSection.classList.contains("dl-hidden")) {
                obs.disconnect(); // Stop observing once triggered

                console.log("🎵 Song is loaded and download buttons are visible!");

                // Inform the user via toast
                if (typeof showToast === "function") {
                    showToast("⚡ Downloading original song automatically...", "ok");
                }

                // Wait 1 second, then automatically click the original audio button
                setTimeout(function () {
                    // Dynamically build the selector using our variable (e.g., '[data-audio-format="mp3"]')
                    var targetAudioBtn = document.querySelector('[data-audio-format="' + songFormat + '"]');

                    if (targetAudioBtn) {
                        console.log("🚀 Automatically clicking the " + songFormat.toUpperCase() + " button now!");
                        targetAudioBtn.click(); // Triggers the corresponding button!
                    } else {
                        console.error("❌ Audio button for format '" + songFormat + "' could not be found.");
                    }
                }, 100);
            }
        });

        // Start watching the download section for class changes
        observer.observe(dlSection, { attributes: true, attributeFilter: ["class"] });
    }

})();


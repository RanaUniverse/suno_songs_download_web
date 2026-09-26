"""
app/bot/keyboards.py

Here i will defines some keyboards so that i can easily import this
"""

from telegram import InlineKeyboardButton, WebAppInfo
from app.utils import generate_song_download_url


def generate_dynamic_keyboard(
    final_url: str,
    mini_app_url: str | None = None,
):
    """
    Generates the structured keyboard layout for song options:
    - Row 1: Original Song (Wide)
    - Row 2: MP3 & WAV (Split)
    - Row 3: Video Download & Open in Suno (Split)
    - Row 4: Select Song Mini App (Flask Web App integration)
    """

    # 1. Generate URLs dynamically using your function
    original_link = generate_song_download_url(final_url, song_type="original")
    mp3_link = generate_song_download_url(final_url, song_type="mp3")
    wav_link = generate_song_download_url(final_url, song_type="wav")

    # 2. Build the rows structure
    keyboard = [
        # Row 1: Wide button for Original Song
        [InlineKeyboardButton("🎵 Download Original Song", url=original_link)],
        # Row 2: 2 buttons side-by-side (MP3 & WAV)
        [
            InlineKeyboardButton("🎧 MP3 Format", url=mp3_link),
            InlineKeyboardButton("🎼 WAV Format", url=wav_link),
        ],
        # Row 3: Video download & Direct Suno link
        [
            InlineKeyboardButton("📥 Download Video", url="https://rana49.online"),
            InlineKeyboardButton("🌐 Open in Suno", url=final_url),
        ],
    ]

    # Row 4: The "Select Song to Download" Web App button idea 💡
    if mini_app_url:
        keyboard.append(
            [
                InlineKeyboardButton(
                    "✨ Select Songs in Web App", web_app=WebAppInfo(url=mini_app_url)
                )
            ]
        )

    return keyboard

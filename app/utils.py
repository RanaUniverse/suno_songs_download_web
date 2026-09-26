"""
app/utils.py

This will have some things need for different cases
"""

from typing import Literal


from urllib.parse import urlencode

from app.config import settings

SUNO_DOWNLOADER_URL = settings.suno_downloader_url


def generate_song_download_url(
    song_url: str,
    action: Literal["now", "later"] = "now",
    song_type: Literal["original", "mp3", "wav"] = "original",
    song_downloader_website: str = SUNO_DOWNLOADER_URL,
):
    base_url = f"{song_downloader_website.rstrip('/')}/song_download"

    params = {
        "url": song_url,
        "action": action,
        "song_type": song_type,
    }

    query_string = urlencode(params)

    return f"{base_url}?{query_string}"


if __name__ == "__main__":
    # === Example Usage ===
    my_new_link = generate_song_download_url(
        song_url="https://suno.com/s/JKmaWAzKI6CiuQMJ",
        action="now",
        song_type="mp3",
        song_downloader_website="http://localhost:9999",
    )

    print(my_new_link)
    # Output:
    # http://localhost:9999/song_download?url=https%3A%2F%2Fsuno.com%2Fs%2FDBXtonHQk8CBZyx8&action=now&song_type=mp3

"""
app/shared/song_info.py

This has some basic things which i will write here and
then use htis in different places
"""

from dataclasses import dataclass
import re


import requests


@dataclass
class SunoSongData:
    id: str = ""
    title: str = "Suno Song"
    image_url: str = ""
    audio_url: str = ""

    # Optional: A handy method to convert it back to a dict if template or JSON needs it
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "image_url": self.image_url,
            "audio_url": self.audio_url,
        }


def fetch_basic_suno_song_data(target_url: str) -> SunoSongData:
    """
    Helper function that takes a Suno song link (or short link),
    fetches the page, handles redirects, extracts the ID and title,
    and returns a structured SunoSongData object.
    """
    song_id = ""
    title = "Suno Song"

    if not target_url:
        return SunoSongData()

    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/151.0.0.0 Safari/537.36"
            )
        }

        # Fetch the page, allowing redirects for short links
        resp = requests.get(
            target_url, headers=headers, allow_redirects=True, timeout=5
        )

        if resp.status_code == 200:
            html = resp.text
            final_url = resp.url

            # Extract title from HTML <title> tag
            title_match = re.search(r"<title>([^<]*)</title>", html, re.IGNORECASE)
            if title_match:
                raw_title = title_match.group(1)
                title = re.sub(r"\s*\|\s*Suno\s*$", "", raw_title).strip()

            # Look for a UUID anywhere in the final URL or inside the HTML text payload
            uuid_pattern = (
                r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
            )

            id_match = re.search(uuid_pattern, final_url, re.IGNORECASE)
            if not id_match:
                id_match = re.search(uuid_pattern, html, re.IGNORECASE)

            song_id = id_match.group(0).lower() if id_match else ""

    except Exception as e:
        print(f"❌ Failed to fetch song metadata server-side for {target_url}: {e}")

    # Return a clean dataclass instance
    return SunoSongData(
        id=song_id,
        title=title,
        image_url=f"https://cdn2.suno.ai/image_{song_id}.jpeg" if song_id else "",
        audio_url=f"https://cdn1.suno.ai/{song_id}.mp3" if song_id else "",
    )

"""
src/suno_1_checking/app/__init__.py

Here i will try to call the external service from my server
"""

import requests


from app.config import settings


def call_external_post_api_call(
    content_id: str,
    content_type: str = "clip",
    url: str | None = None,
) -> str:

    if url is None:
        url = str(settings.urls.rights)

    headers = {
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.7",
        "Content-Type": "application/json",
        "Origin": f"{settings.urls.base}",
        "Referer": f"{settings.urls.base}",
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/151.0.0.0 Safari/537.36"
        ),
    }

    data = {
        "content_params": {
            "content_id": content_id,
            "content_type": content_type,
        }
    }

    try:
        response = requests.post(
            url,
            headers=headers,
            json=data,
            timeout=10,
        )

        # print("STATUS:", response.status_code)
        # print("URL:", response.url)
        # print("HEADERS:", dict(response.headers))
        # print("BODY:", response.text[:3000])

        response.raise_for_status()

        # response.raise_for_status()

        return response.json()

    except requests.RequestException:
        raise


def get_suno_proxy(
    song_url: str,
    proxy_url: str | None = None,
) -> bytes:
    base_url = settings.urls.base
    if proxy_url is None:
        proxy_url = str(settings.urls.suno_proxy)

    params = {
        "url": song_url,
    }

    headers = {
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.7",
        "Origin": f"{base_url}",
        "Referer": f"{base_url}/",
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/151.0.0.0 Safari/537.36"
        ),
    }

    response = requests.get(
        proxy_url,
        params=params,
        headers=headers,
        timeout=10,
    )

    # print(response.url)  # see the dynamically generated URL

    response.raise_for_status()

    return response.content


if __name__ == "__main__":

    # This below is a song of external songs of suno
    id_ = "520fac44-dee5-4b34-a7b2-b5d62348e718"
    call_external_post_api_call(
        content_id=id_,
    )

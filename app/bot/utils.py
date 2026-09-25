"""
app/bot/utils.py

Here i will write some code which will help to
get the correct things for differne purpose
"""

from urllib.parse import urlparse


from telegram import MessageEntity

TARGET_DOMAIN = "rana49.online"


def extract_valid_link_from_text(
    urls_dict: dict[MessageEntity, str],
    target_domain: str = TARGET_DOMAIN,
) -> tuple[bool, str]:
    """
    If this got match then it will give me true and the link,
    if it not match it will give me false, last_link
    """

    valid_url = None
    formatted_url = ""

    for _, url_text in urls_dict.items():
        if url_text.startswith(("http://", "https://")):
            formatted_url = url_text
        else:
            formatted_url = "https://" + url_text

        parsed_url = urlparse(formatted_url)
        domain = parsed_url.netloc.lower()

        if domain == TARGET_DOMAIN or domain.endswith(f".{TARGET_DOMAIN}"):
            valid_url = formatted_url
            break

    if valid_url:
        return True, valid_url
    else:
        return False, formatted_url

"""
app/bot/handlers.py

Here i will write some handlers code which i will use
"""

from telegram import Update, MessageEntity


from telegram.ext import (
    ContextTypes,
)

from app.config import settings
from app.logger_related import RanaLogger
from app.bot.utils import extract_valid_link_from_text, SUNO_TARGET_DOMAIN
from app.utils import get_random_demo_songs_links


from app.utils import generate_song_download_url

BOT_TOKEN = settings.telegram_bot_token.get_secret_value()


async def caps(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    This will send the later part of the command return in upper text
    '/caps this text will go to uppercase'
    """
    if not update.effective_user:
        return

    if not context.args:
        warning_text = (
            "⚠️ <b>Oops!</b> You forgot to add some text.\n\n"
            "Please use words after the /caps command like this:\n"
            "<code>/caps hello world</code> 🔠"
        )
        await context.bot.send_message(
            chat_id=update.effective_user.id,
            text=warning_text,
        )
        return

    uppercased_text = " ".join(context.args).upper()

    response_text = f"🔠 <b>Your Uppercased Text:</b>\n\n\n{uppercased_text}"
    await context.bot.send_message(
        update.effective_user.id,
        response_text,
    )


async def get_url_from_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    This will try to extract the url from the text and send user back.

    From the user text, i want it will extract the first url and then try
    to match this with my base_url ie target_url
    """

    message = update.message

    if not update.effective_chat:
        return

    if not message or not message.text:
        RanaLogger.warning("Message should present when in text")
        return

    # https://docs.python-telegram-bot.org/en/stable/telegram.message.html#telegram.Message.parse_entities
    urls_dict = message.parse_entities(types=[MessageEntity.URL])
    print(f"Printing the URLS LIST {urls_dict}")

    if not urls_dict:
        await message.reply_text(
            "❌ No link found in your message! Please send a link of the Song. 🔗"
        )
        return

    is_valid, final_url = extract_valid_link_from_text(urls_dict)

    if not is_valid:
        random_songs = get_random_demo_songs_links(3)
        links_formatted = "\n".join([f"<code>{link}</code>" for link in random_songs])

        txt = (
            f"⚠️ <b>Invalid Link Detected!</b>\n\n"
            f"Your link (<code>{final_url}</code>) does not match our platform (<b>{SUNO_TARGET_DOMAIN}</b>).\n\n"
            f"💡 <i>Please send a valid song link directly from our website.</i>\n\n"
            f"Send Me Back Any Link From the Given List."
            f"📋 <b>Try copying one of these working demo links to test:</b>\n"
            f"{links_formatted}"
        )
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text=txt,
        )
        return

    now_song_download_link = generate_song_download_url(
        song_url=final_url, action="now"
    )
    later_song_download_link = generate_song_download_url(
        song_url=final_url, action="later"
    )

    txt = (
        f"✅ <b>Valid URL Recognized!</b> 🎉\n\n"
        f"🔗 <b>Your Song Link:</b>\n<code>{final_url}</code>\n\n"
        f"📥 <b>Choose your download option:</b>\n"
        f"• ⚡ <a href='{now_song_download_link}'><b>Download Now</b></a> (Instant processing)\n\n\n"
        f"• 🕒 <a href='{later_song_download_link}'><b>Download Later</b></a> (Save to queue)\n\n"
        f"<i>Tap a link above to grab your Suno track! 🎶</i>"
    )

    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text=txt,
    )

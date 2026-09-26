"""
app/bot/handlers.py

Here i will write some handlers code which i will use
"""

from html import escape


from telegram import Update, MessageEntity, LinkPreviewOptions
from telegram.constants import ChatAction
from telegram.error import BadRequest, TelegramError

from telegram.ext import (
    ContextTypes,
)

from app.config import settings
from app.logger_related import RanaLogger
from app.bot.utils import extract_valid_link_from_text, SUNO_TARGET_DOMAIN
from app.utils import get_random_demo_songs_links


from app.utils import generate_song_download_url

from app.shared.song_info import fetch_basic_suno_song_data

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

    message = update.effective_message
    chat = update.effective_chat

    if not message or not chat:
        RanaLogger.warning("Message & Chat should present when in text")
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
            chat_id=chat.id,
            text=txt,
        )
        return

    # now_song_download_link = generate_song_download_url(
    #     song_url=final_url, action="now"
    # )
    # later_song_download_link = generate_song_download_url(
    #     song_url=final_url, action="later"
    # )

    txt = (
        f"🎵 <b>Song Link Received!</b> ✨\n\n"
        f"🔗 <b>Source URL</b>\n"
        f'🔗 <a href="{final_url}"><b>Open Song in Suno App</b></a>\n\n'
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"🔍 <b>Fetching song details...</b>\n\n"
        f"⏳ Please wait while I:\n"
        f"• 🎧 Identify the song\n"
        f"• 🖼️ Fetch the cover artwork\n"
        f"• 🎵 Prepare the audio details\n"
        f"• 📥 Get everything ready for you\n\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"🚀 <i>Almost there! Your song details will appear below shortly...</i> 🎶"
    )
    # f"• ⚡ <a href='{now_song_download_link}'><b>Download Now</b></a> (Instant processing)\n\n\n"
    # f"• 🕒 <a href='{later_song_download_link}'><b>Download Later</b></a> (Save to queue)\n\n"
    # f"<i>Tap a link above to grab your Suno track! 🎶</i>"

    wait_message = await message.reply_text(
        text=txt,
        do_quote=True,
    )

    await message.reply_chat_action(
        action=ChatAction.UPLOAD_PHOTO,
    )

    song_data = fetch_basic_suno_song_data(
        target_url=final_url,
    )
    print(
        "Song Data for checking",
        song_data,
    )

    song_title = escape(song_data.title)
    song_id = escape(song_data.id)

    # Below condition is when the suno dont recognize the music
    # that's why they send sometime random id
    if song_data.title.strip() == "Suno | AI Music Generator":
        print("❌ This does not appear to be a valid song.")

        suno_song_url = f"https://suno.com/song/{song_data.id}"

        text = (
            "❌ <b>Song Not Found</b>\n\n"
            "The URL you sent does not appear to point to a valid "
            "Suno song.\n\n"
            f"🆔 <b>Instead You Can Check This ID:</b>\n"
            f"<code>{escape(song_data.id)}</code>\n\n"
            f"🔗 <b>Suno URL:</b>\n"
            f'<a href="{escape(suno_song_url)}">{escape(suno_song_url)}</a>\n\n'
            "📩 Please send a valid Suno song URL and try again."
        )

        await message.reply_text(
            text=text,
            do_quote=True,
            link_preview_options=LinkPreviewOptions(is_disabled=True),
        )

        return

    caption = (
        "🎵 <b>Song Details</b>\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        f"🎧 <b>Title:</b> <i>{song_title}</i>\n\n"
        f"🆔 <b>Song ID:</b>\n"
        f"<code>{song_id}</code>\n\n"
        "✨ <b>Your song is ready!</b>\n"
        "📥 Choose an option below to continue.\n\n"
        "🎶 <i>Enjoy your music!</i>"
    )

    try:
        await message.reply_photo(
            photo=song_data.image_url,
            caption=caption,
            parse_mode="HTML",
            do_quote=True,
        )
        await wait_message.delete()

    except BadRequest as e:
        print(f"❌ Telegram could not send the image: {e}")

        await message.reply_text(
            "❌ <b>Couldn't Process This Song</b>\n\n"
            "It looks like this link is <b>invalid, unavailable, "
            "or no longer accessible</b>.\n\n"
            "🔗 Please send a valid <b>Suno song URL</b> and try again.\n\n"
            "🎵 <i>Send the song link again to continue.</i>",
            do_quote=True,
        )

    except TelegramError as e:
        print(f"❌ Telegram error while sending photo: {e}")

        await message.reply_text(
            caption,
            do_quote=True,
        )

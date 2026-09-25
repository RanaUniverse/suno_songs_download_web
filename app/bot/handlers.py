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
from app.bot.utils import extract_valid_link_from_text, TARGET_DOMAIN

BOT_TOKEN = settings.telegram_bot_token.get_secret_value()


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):

    user = update.effective_user

    if not user:
        RanaLogger.error("Could not retrieve effective user from update.")
        return

    welcome_message = (
        f"Hey <b>{user.full_name}</b>! 👋\n\n"
        "Welcome! You've successfully started the bot. Thanks for connecting! 🚀"
    )

    await context.bot.send_message(
        chat_id=user.id,
        text=welcome_message,
    )


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


async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    This function will only say the same word the user has say to bot
    """
    if not update.effective_chat:
        return

    if not update.message or not update.message.text:
        return

    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text=update.message.text,
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

    # 3. Respond based on the results
    if not is_valid:
        txt = f"⚠️ Your link ie, <code>{final_url}</code> does not match our main link (ie. <b>{TARGET_DOMAIN}</b>)."
    else:
        txt = f"✅ Success! You sent a valid URL:\n<code>{final_url}</code>"

    await context.bot.send_message(
        chat_id=update.effective_chat.id,
        text=txt,
    )

"""
app/bot/basic_commands_handlers.py

Here i will write some handlers code which i will use
"""

from telegram import Update


from telegram.ext import (
    ContextTypes,
)

from app.config import settings
from app.logger_related import RanaLogger

from app.bot.text_placeholders import (
    get_welcome_message,
    settings_text,
    help_text,
    about_text,
    token_text,
)

BOT_TOKEN = settings.telegram_bot_token.get_secret_value()


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):

    user = update.effective_user

    if not user:
        RanaLogger.error("Could not retrieve effective user from update.")
        return

    txt = get_welcome_message(
        full_name=user.full_name,
    )
    await context.bot.send_message(
        text=txt,
        chat_id=user.id,
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Provides help instructions for using the bot."""
    message = update.message
    if not message:
        return

    await message.reply_text(help_text)


async def about_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Tells the user about the project and web app connection."""
    message = update.message
    if not message:
        return

    await message.reply_text(about_text)


async def settings_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Placeholder for managing user settings."""
    message = update.message
    if not message:
        return

    await message.reply_text(settings_text)


async def token_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Placeholder for managing account tokens linked to the web app."""
    message = update.message
    if not message:
        return

    await message.reply_text(token_text)

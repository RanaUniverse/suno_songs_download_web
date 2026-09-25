"""
app/bot/making_application.py

Make the application object here so that i can use this
to run my application there
"""

from telegram.ext import ApplicationBuilder, Defaults
from telegram.constants import ParseMode

from app.config import settings

BOT_TOKEN = settings.telegram_bot_token.get_secret_value()

my_defaults = Defaults(
    parse_mode=ParseMode.HTML,
)

application = (
    ApplicationBuilder()
    .token(
        BOT_TOKEN,
    )
    .defaults(
        my_defaults,
    )
    .build()
)

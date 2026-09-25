"""
main_for_tg_bot.py

This is the entrypoint to start the tg bot
"""

from telegram.ext import (
    CommandHandler,
    MessageHandler,
    filters,
)


from app.bot.handlers import (
    start,
    caps,
    get_url_from_message,
)

from app.bot.making_application import application

if __name__ == "__main__":

    start_handler = CommandHandler("start", start)
    echo_handler = MessageHandler(
        filters=filters.TEXT & (~filters.COMMAND),
        callback=get_url_from_message,
    )
    caps_handler = CommandHandler("caps", caps)

    application.add_handler(start_handler)
    application.add_handler(echo_handler)
    application.add_handler(caps_handler)

    application.run_polling()

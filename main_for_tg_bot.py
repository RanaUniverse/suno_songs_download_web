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
    caps,
    get_url_from_message,
)

from app.bot.basic_commands_handlers import (
    start_command,
    help_command,
    about_command,
    settings_command,
    token_command,
    photo_command,
)

from app.bot.making_application import application

if __name__ == "__main__":

    start_handler = CommandHandler("start", start_command)
    echo_handler = MessageHandler(
        filters=filters.TEXT & (~filters.COMMAND),
        callback=get_url_from_message,
    )
    caps_handler = CommandHandler("caps", caps)
    help_handler = CommandHandler("help", help_command)
    about_handler = CommandHandler("about", about_command)
    settings_handler = CommandHandler("settings", settings_command)
    token_handler = CommandHandler("token", token_command)
    photo_handler = CommandHandler("photo", photo_command)

    application.add_handler(start_handler)
    application.add_handler(echo_handler)
    application.add_handler(caps_handler)
    application.add_handler(help_handler)
    application.add_handler(about_handler)
    application.add_handler(settings_handler)
    application.add_handler(token_handler)
    application.add_handler(photo_handler)

    application.run_polling()

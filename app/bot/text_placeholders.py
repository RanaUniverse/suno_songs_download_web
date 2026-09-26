"""
app/bot/text_placeholders.py

Here i will write the placeholders of the text i will want to send to the
user based on differnet command and so on.
"""

from app.config import settings


def get_welcome_message(full_name: str) -> str:
    welcome_message = (
        f"Hey <b>{full_name}</b>! 👋\n\n"
        "Welcome to the <b>Ai Song Downloader Bot - Suno Ai</b>! 🎵🚀\n\n"
        "📥 <b>How to start:</b>\n"
        "Simply send me the link of the song you want to download from our platform, and I'll handle the rest for you! ✨\n\n"
        "📋 <b>Available Commands:</b>\n"
        "• /start - Restart the bot & see this welcome message\n"
        "• /help - Get assistance on how to use the bot\n"
        "• /settings - Customize your bot preferences\n"
        "• /token - Manage or check your account token\n"
        "• /about - Learn more about this project\n\n"
        "Whenever you're ready, just drop your song link below! 👇"
    )
    return welcome_message


help_text = (
    "🤖 <b>Help Center - Suno Song Downloader</b> 🎵\n\n"
    "Here is how you can use this bot:\n"
    "1️⃣ Copy a song link from our web platform (<code>rana49.online</code>).\n"
    "2️⃣ Paste and send the link directly here in the chat.\n"
    "3️⃣ The bot will validate the link and prepare your song for download! ✨\n\n"
    "<b>Need more assistance?</b> Contact our support or check out /about."
)

about_text = (
    "ℹ️ <b>About This Project</b> 🚀\n\n"
    "This Telegram bot is the companion tool for our <b>Suno Song Download Web App</b>! 🎶\n\n"
    "Built with Python, Linux Ubuntu, and powered by <code>python-telegram-bot</code>, "
    "it bridges our web platform directly to your Telegram chat for fast and easy song management. 🐧💻\n\n"
    f"🌐 Main Website: <b>{settings.suno_target_url}</b>"
)

settings_text = (
    "⚙️ <b>Your Bot Settings</b>\n\n"
    "Here you will soon be able to configure your download preferences, notification alerts, and audio quality formats! 🎛️\n\n"
    "<i>(Coming soon as we connect the web app database! Stay tuned 🚀)</i>"
)

token_text = (
    "🔑 <b>Account Token Management</b>\n\n"
    "To link your Telegram account with your profile on <b>rana49.online</b>, "
    "you will be able to generate and submit your access token here.\n\n"
    "<i>(This will soon let the bot sync downloads directly with your web account! 🌐)</i>"
)

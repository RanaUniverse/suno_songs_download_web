"""
app/config.py

Here i will keep configuration settings now
later i will switch to pydantic-settigns if need
"""

from functools import lru_cache
from typing import Literal

from pydantic import (
    # AnyHttpUrl,
    BaseModel,
    EmailStr,
    Field,
    SecretStr,
)

from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class URLSettings(BaseModel):
    rights: str
    base: str
    suno_proxy: str


class AppSettings(BaseModel):
    """
    Here i will keep flask app related things to run
    """

    host: str = "0.0.0.0"
    port: int = 9999
    debug: bool = False
    secret_key: SecretStr
    login_backend: Literal[
        "SQLMODEL",
        "MONGODB",
        "MEMORY",
    ]
    validation_mode: Literal[
        "DEVELOPMENT",
        "PRODUCTION",
    ] = "DEVELOPMENT"


class MailAddressSettings(BaseModel):
    """
    All the email address which need to be given
    in different case i will keep those here
    """

    # This from email should be match in the coresponding provider
    from_email_default: EmailStr

    reply_to_default: EmailStr | None = Field(default=None, repr=False)


class MailSettings(BaseModel):
    """
    Email related configuraiton will be here
    username and password i will get to login
    and from email is my email id other will see
    """

    provider: Literal[
        "local",
        "smtp",
    ]
    # how i can say it value will only, "local" or "smtp"

    host: str
    port: int
    username: str
    password: SecretStr
    security: Literal[
        "ssl",
        "starttls",
    ]

    address: MailAddressSettings


class OTPSettings(BaseModel):

    backend: Literal[
        "local",
        "redis",
    ]


class RedisSettings(BaseModel):
    """
    Redis config will be here
    """

    host: str = "localhost"
    port: int = 6379
    db: int = 0

    username: str | None = None
    password: SecretStr | None = None

    # If provided, this takes priority over host,port,etc.
    url: str | None = None


class DatabaseSettings(BaseModel):
    """
    Database related maybe i will use postgres or sqlite
    so their configurations i will write here

    For Sqlite i will just use the default things.
    For Postgres i will use all the username, password,
    host, port, name should be given
    """

    backend: Literal[
        "sqlite",
        "postgres",
    ] = "sqlite"

    sqlite_filename: str = "local_database.db"

    username: str | None = None
    password: SecretStr | None = None
    host: str | None = None
    port: int | None = None
    name: str | None = None

    @property
    def db_url(self) -> str:
        if self.backend == "postgres":
            if (
                self.username is None
                or self.password is None
                or self.host is None
                or self.port is None
                or self.name is None
            ):
                raise RuntimeError(
                    f"For Postgresql the value of all DB "
                    "Connections this must be not None",
                )

            POSTGRES_URL = (
                f"postgresql+psycopg2://"
                f"{self.username}:"
                f"{self.password.get_secret_value()}@"
                f"{self.host}:"
                f"{self.port}/"
                f"{self.name}"
            )
            return POSTGRES_URL

        elif self.backend == "sqlite":
            sqlite_filepath = self.sqlite_filename
            SQLITE_URL = f"sqlite:///" f"{sqlite_filepath}"
            return SQLITE_URL

        else:
            raise RuntimeError(
                "Database should be sqlite or postgres for now",
            )


class Settings(BaseSettings):
    """
    db: DatabaseSettings = DatabaseSettings()
    I give this because when not any default values set for the db
    it will make the class instance and use this values there!
    """

    owner_name: str

    telegram_bot_token: SecretStr

    suno_target_url: str = "suno.com"

    suno_downloader_url: str = "s1.rana49.online"

    log_filename: str = "LogFile.log"
    data_foldername: str = "data"

    app: AppSettings
    otp: OTPSettings
    mail: MailSettings = Field(repr=False)
    db: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings

    urls: URLSettings

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="allow",
    )


@lru_cache
def get_settings() -> Settings:
    """
    i will use this to get my values
    """
    return Settings()  # type: ignore


settings = get_settings()

if __name__ == "__main__":

    print(settings.db.db_url)
    print(settings.urls.base)
    print(settings.urls.rights)
    print(settings.urls.suno_proxy)
    print("xxx")
    print(str(settings.urls.base))
    print(str(settings.urls.rights))
    print(str(settings.urls.suno_proxy))

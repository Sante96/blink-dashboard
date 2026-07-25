"""
Configurazione dell'applicazione, caricata da config.toml (se presente).

Ogni campo ha un default sensato: il file TOML è opzionale e sovrascrive solo
i campi presenti. In produzione il file sta accanto a main.py (resource_dir).
"""

import tomllib
from dataclasses import dataclass, field
from pathlib import Path

CONFIG_PATH = Path(__file__).parent / "config.toml"


@dataclass
class ServerConfig:
    host: str = "127.0.0.1"
    port: int = 8000


@dataclass
class BlinkConfig:
    settle_delay: float = 1.5
    retry_attempts: int = 5


@dataclass
class StorageConfig:
    credentials_dir: str = ""
    temp_dir: str = ""
    max_cache_mb: int = 500


@dataclass
class LoggingConfig:
    level: str = "info"


@dataclass
class AppConfig:
    server: ServerConfig = field(default_factory=ServerConfig)
    blink: BlinkConfig = field(default_factory=BlinkConfig)
    storage: StorageConfig = field(default_factory=StorageConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)


def load_config() -> AppConfig:
    cfg = AppConfig()
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "rb") as f:
            raw = tomllib.load(f)
        for section_name, dc in [
            ("server", cfg.server),
            ("blink", cfg.blink),
            ("storage", cfg.storage),
            ("logging", cfg.logging),
        ]:
            for k, v in raw.get(section_name, {}).items():
                if hasattr(dc, k):
                    setattr(dc, k, v)
    return cfg


config = load_config()

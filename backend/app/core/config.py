from pathlib import Path
from typing import Dict, Type
from pydantic_settings import BaseSettings
from app.models import PDFReader, DocumentReader

class Settings(BaseSettings):
    TEMP_DIR: Path = Path("./temp")
    HEADER_THRESHOLD: float = 0.1
    FOOTER_THRESHOLD: float = 0.9
    DEFAULT_EXCLUDE_HEADERS: bool = True
    DEFAULT_EXCLUDE_FOOTERS: bool = True
    SUPPORTED_FORMATS: Dict[str, Type[DocumentReader]] = {
        '.pdf': PDFReader,
        # Add more formats here:
        # '.docx': DocxReader,
        # '.txt': TxtReader,
    }

settings = Settings()
settings.TEMP_DIR.mkdir(exist_ok=True)
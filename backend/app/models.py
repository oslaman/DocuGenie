from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any, Optional

class DocumentReader(ABC):
    @abstractmethod
    def __init__(self, 
                 header_threshold: Optional[float] = None, 
                 footer_threshold: Optional[float] = None,
                 exclude_headers: Optional[bool] = None,
                 exclude_footers: Optional[bool] = None):
        pass

    @abstractmethod
    def read_document(self, file_path: str) -> Tuple[List[Tuple[str, int]], Dict[str, Any]]:
        """Returns tuple of (text_with_pages, metadata)"""
        pass


class PDFReader(DocumentReader):
    def __init__(self, 
                 header_threshold: Optional[float] = None, 
                 footer_threshold: Optional[float] = None,
                 exclude_headers: Optional[bool] = None,
                 exclude_footers: Optional[bool] = None):
        self.header_threshold = header_threshold or settings.HEADER_THRESHOLD
        self.footer_threshold = footer_threshold or settings.FOOTER_THRESHOLD
        self.exclude_headers = exclude_headers if exclude_headers is not None else settings.DEFAULT_EXCLUDE_HEADERS
        self.exclude_footers = exclude_footers if exclude_footers is not None else settings.DEFAULT_EXCLUDE_FOOTERS

    def read_document(self, file_path: str) -> Tuple[List[Tuple[str, int]], Dict[str, Any]]:
        document = fitz.open(file_path)
        text_with_pages = []

        try:
            for page_num in range(len(document)):
                page = document.load_page(page_num)
                blocks = sorted(page.get_text("blocks"), key=lambda b: b[1])
                
                body_blocks = self._filter_blocks(blocks, page.rect.height)
                if body_blocks:
                    body_text = "\n".join([block[4] for block in body_blocks])
                    text_with_pages.append((body_text, page_num + 1))

            metadata = {
                "title": document.metadata.get("title", "Unknown"),
                "author": document.metadata.get("author", "Unknown"),
                "num_pages": len(document),
                "file_type": "pdf"
            }

            return text_with_pages, metadata
        finally:
            document.close()

    def _filter_blocks(self, blocks: List, page_height: float) -> List:
        header_threshold = page_height * self.header_threshold if self.exclude_headers else 0
        footer_threshold = page_height * self.footer_threshold if self.exclude_footers else page_height
        
        return [block for block in blocks 
                if header_threshold <= block[1] <= footer_threshold]

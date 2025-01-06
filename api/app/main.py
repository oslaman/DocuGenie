from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from abc import ABC, abstractmethod
import fitz
import time
from pathlib import Path
from langchain.text_splitter import RecursiveCharacterTextSplitter
from typing import List, Tuple, Dict, Any, Optional

# Constants
TEMP_DIR = Path("./temp")
TEMP_DIR.mkdir(exist_ok=True)
HEADER_THRESHOLD = 0.1
FOOTER_THRESHOLD = 0.9
DEFAULT_EXCLUDE_HEADERS = True
DEFAULT_EXCLUDE_FOOTERS = True

class ChunkedProcessor:
    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 300):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def process(self, processed_text: List[Tuple[str, int]], metadata: Dict) -> Dict[str, Any]:
        chunks, chunk_page_numbers = self._chunk_text(processed_text)
        metadata["num_chunks"] = len(chunks)
        return {
            "metadata": metadata,
            "chunks": [{"index": i, "page": chunk_page_numbers[i], "text": chunk} 
                      for i, chunk in enumerate(chunks)]
        }

    def _chunk_text(self, processed_text: List[Tuple[str, int]]) -> Tuple[List[str], List[int]]:
        all_text = ""
        page_boundaries = []
        current_position = 0

        for text, page_number in processed_text:
            all_text += text
            page_boundaries.append((current_position, current_position + len(text), page_number))
            current_position += len(text)

        result = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ".", "?", "!", " ", ""]
        ).create_documents([all_text])
        
        chunks = [doc.page_content for doc in result]
        chunk_page_numbers = []

        for chunk in chunks:
            chunk_start = all_text.find(chunk)
            chunk_end = chunk_start + len(chunk)
            for start, end, page_number in page_boundaries:
                if start <= chunk_start < end or start < chunk_end <= end:
                    chunk_page_numbers.append(page_number)
                    break

        return chunks, chunk_page_numbers

# Document Reader Strategy Pattern
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
        self.header_threshold = header_threshold or HEADER_THRESHOLD
        self.footer_threshold = footer_threshold or FOOTER_THRESHOLD
        self.exclude_headers = exclude_headers if exclude_headers is not None else DEFAULT_EXCLUDE_HEADERS
        self.exclude_footers = exclude_footers if exclude_footers is not None else DEFAULT_EXCLUDE_FOOTERS

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

class DocumentHandler:
    def __init__(self, reader: DocumentReader):
        self.reader = reader
        self.processor = ChunkedProcessor()

    def process_document(self, file_path: str) -> Dict[str, Any]:
        text_with_pages, metadata = self.reader.read_document(file_path)
        return self.processor.process(text_with_pages, metadata)

# File type mapping
SUPPORTED_FORMATS = {
    '.pdf': PDFReader,
    # Add more formats here:
    # '.docx': DocxReader,
    # '.txt': TxtReader,
}

# FastAPI Setup
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process-document")
async def process_document(
    files: List[UploadFile] = File(...),
    header_threshold: Optional[float] = None,
    footer_threshold: Optional[float] = None,
    exclude_headers: Optional[bool] = None,
    exclude_footers: Optional[bool] = None
):
    processed_data = {"chunks": []}
    
    for file in files:
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in SUPPORTED_FORMATS:
            continue
            
        temp_file = TEMP_DIR / f"temp_{int(time.time())}_{file.filename}"
        try:
            await file.seek(0)
            with open(temp_file, "wb") as f:
                f.write(await file.read())
            
            reader = SUPPORTED_FORMATS[file_ext](
                header_threshold=header_threshold,
                footer_threshold=footer_threshold,
                exclude_headers=exclude_headers,
                exclude_footers=exclude_footers
            )
            document_handler = DocumentHandler(reader)
            result = document_handler.process_document(str(temp_file))
            
            # Add filename to each chunk
            for chunk in result["chunks"]:
                chunk["filename"] = file.filename
            processed_data["chunks"].extend(result["chunks"])
                
        except Exception as e:
            print(f"Error processing {file.filename}: {str(e)}")
            continue
        finally:
            temp_file.unlink(missing_ok=True)

    if not processed_data["chunks"]:
        return JSONResponse(
            status_code=400,
            content={"error": "No files were successfully processed"}
        )

    return JSONResponse(content=processed_data)

@app.get("/")
async def root():
    return {"message": "DocuGenie"}

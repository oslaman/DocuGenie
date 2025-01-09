from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from abc import ABC, abstractmethod
import fitz
import time
from pathlib import Path
from langchain.text_splitter import RecursiveCharacterTextSplitter
from typing import List, Tuple, Dict, Any, Optional
from app.core.config import settings
from app.models import DocumentReader


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


class DocumentHandler:
    def __init__(self, reader: DocumentReader):
        self.reader = reader
        self.processor = ChunkedProcessor()

    def process_document(self, file_path: str) -> Dict[str, Any]:
        text_with_pages, metadata = self.reader.read_document(file_path)
        return self.processor.process(text_with_pages, metadata)

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
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import ChunkedProcessor, DocumentHandler

router = APIRouter(prefix="/process-document")


@router.post("/")
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
        if file_ext not in settings.SUPPORTED_FORMATS:
            continue
            
        temp_file = settings.TEMP_DIR / f"temp_{int(time.time())}_{file.filename}"
        try:
            await file.seek(0)
            with open(temp_file, "wb") as f:
                f.write(await file.read())
            
            reader = settings.SUPPORTED_FORMATS[file_ext](
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
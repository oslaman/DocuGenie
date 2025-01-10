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
import logging
import os


router = APIRouter(prefix="/process-document")

# Configure logging
logging.basicConfig(level=logging.DEBUG)

@router.post("/")
async def process_document(
    file: UploadFile = File(...),
    header_threshold: Optional[float] = None,
    footer_threshold: Optional[float] = None,
    exclude_headers: Optional[bool] = None,
    exclude_footers: Optional[bool] = None
):  
    processed_data = {"chunks": []}

    
    try:
        logging.debug(f"Processing file: {file.filename}")
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in settings.SUPPORTED_FORMATS:
            logging.error(f"Unsupported file format: {file_ext}")
            return JSONResponse(
                status_code=400,
                content={"error": "Unsupported file format"}
            )
            
        temp_file = settings.TEMP_DIR / f"temp_{int(time.time())}_{file.filename}"
        try:
            contents = await file.read()
            logging.debug(f"File size: {len(contents)} bytes")
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
            
            for chunk in result["chunks"]:
                chunk["filename"] = file.filename
            processed_data["chunks"].extend(result["chunks"])
                
        except Exception as e:
            logging.error(f"Error processing {file.filename}: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={"error": f"Error processing {file.filename}"}
            )
        finally:
            temp_file.unlink(missing_ok=True)

        if not processed_data["chunks"]:
            return JSONResponse(
                status_code=400,
                content={"error": "No files were successfully processed"}
            )

        logging.debug("Finished processing files")

        return JSONResponse(content=processed_data)

    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from abc import ABC, abstractmethod
import fitz
import time
from pathlib import Path
from langchain.text_splitter import RecursiveCharacterTextSplitter
from typing import List, Tuple, Dict, Any, Optional
from app.api.main import api_router


# FastAPI Setup
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "DocuGenie"}

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from abc import ABC, abstractmethod
import time
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
from app.api.main import api_router



# FastAPI Setup
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "DocuGenie"}

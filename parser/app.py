"""
FastAPI service for Land Law PDF parsing.

This service provides HTTP endpoints to process Vietnamese Land Law PDF files
and return parsed chunks that can be consumed by the backend ingestion system.
"""

import asyncio
import os
from typing import List, Optional, Dict, Any
import json

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from land_law_parser import (
    LandLawChunkerFinal,
    update_article_260_content,
)


# Pydantic models for request/response
class ParseRequest(BaseModel):
    """Request model for PDF parsing."""

    max_pages: Optional[int] = Field(
        None, description="Maximum number of pages to process"
    )


class ChunkMetadata(BaseModel):
    """Metadata for a parsed chunk."""

    law_id: str
    chapter_id: Optional[str] = None
    chapter_title: Optional[str] = None
    section_id: Optional[str] = None
    section_title: Optional[str] = None
    article_id: str
    article_title: str
    topic: str
    chunk_id: str
    chunk_type: str
    clause_id: Optional[str] = None
    point_id: Optional[str] = None
    page_number: List[int]
    coordinates: List[Dict[str, Any]]
    chunk_footnotes: str
    has_points: Optional[bool] = None


class ParsedChunk(BaseModel):
    """A single parsed chunk from the PDF."""

    page_content: str = Field(..., description="The text content of the chunk")
    metadata: ChunkMetadata = Field(
        ..., description="Metadata associated with the chunk"
    )


class ParseResponse(BaseModel):
    """Response model for PDF parsing results."""

    success: bool = Field(..., description="Whether the parsing was successful")
    chunks: List[ParsedChunk] = Field(..., description="List of parsed chunks")
    total_chunks: int = Field(..., description="Total number of chunks parsed")
    message: str = Field(..., description="Status message")


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str = Field(..., description="Service status")
    message: str = Field(..., description="Health check message")


# FastAPI app initialization
app = FastAPI(
    title="Land Law Parser Service",
    description="HTTP service for parsing Vietnamese Land Law PDF documents",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy", message="Land Law Parser Service is running"
    )


def convert_chunk_to_response_model(chunk: Dict[str, Any]) -> ParsedChunk:
    """Convert internal chunk format to response model."""
    return ParsedChunk(
        page_content=chunk["page_content"], metadata=ChunkMetadata(**chunk["metadata"])
    )


async def process_pdf_async(max_pages: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Process the Land Law PDF file asynchronously using the existing parser.

    Args:
        max_pages: Optional maximum number of pages to process

    Returns:
        List of parsed chunks
    """
    # Fixed path to the Land Law PDF file
    pdf_path = "./data/133-vbhn-vpqh.pdf"

    def _process_pdf():
        """Synchronous PDF processing function."""
        parser = LandLawChunkerFinal(pdf_path, max_pages)
        return parser.process()

    # Run the synchronous parser in a thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    chunks = await loop.run_in_executor(None, _process_pdf)

    chunks = update_article_260_content(chunks)

    return chunks


@app.post("/parse-pdf", response_model=ParseResponse)
async def parse_pdf(request: ParseRequest):
    """
    Parse the Land Law PDF file.

    Args:
        request: ParseRequest containing optional max_pages

    Returns:
        ParseResponse with parsed chunks
    """
    try:
        # Fixed PDF file path
        pdf_path = "./data/133-vbhn-vpqh.pdf"

        # Validate file exists
        if not os.path.exists(pdf_path):
            raise HTTPException(
                status_code=404, detail=f"Land Law PDF file not found: {pdf_path}"
            )

        # Process the PDF
        chunks = await process_pdf_async(request.max_pages)

        # Convert chunks to response format
        response_chunks = [convert_chunk_to_response_model(chunk) for chunk in chunks]

        return ParseResponse(
            success=True,
            chunks=response_chunks,
            total_chunks=len(response_chunks),
            message=f"Successfully parsed {len(response_chunks)} chunks from Land Law PDF",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "Land Law Parser Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "parse_pdf": "/parse-pdf",
            "docs": "/docs",
        },
    }


if __name__ == "__main__":
    # Configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8001))

    print(f"🚀 Starting Land Law Parser Service on {host}:{port}")
    print(f"📚 API Documentation available at http://{host}:{port}/docs")

    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=False,  # Set to True for development
        log_level="info",
    )

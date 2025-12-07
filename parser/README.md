# Land Law Parser Service

A containerized FastAPI service for parsing Vietnamese Land Law PDF documents into structured chunks for the chatbot backend.

## Features

- **FastAPI HTTP Service**: RESTful API with automatic documentation
- **PDF Processing**: Parse Vietnamese Land Law PDFs using PyMuPDF
- **Structured Output**: Returns parsed chunks with metadata for vector database ingestion
- **Docker Support**: Fully containerized with docker-compose
- **Async Processing**: Non-blocking PDF processing for large documents
- **Health Checks**: Built-in health monitoring and status endpoints
- **Modern Python**: Built with Python 3.13 and uv package manager

## Quick Start

### Using Docker (Recommended)

1. **Build and start the service:**
   ```bash
   cd parser
   docker-compose up --build
   ```

2. **Service will be available at:**
   - API: http://localhost:8001
   - Documentation: http://localhost:8001/docs
   - Health Check: http://localhost:8001/health

### Local Development

1. **Install dependencies with uv:**
   ```bash
   uv sync
   ```

2. **Run the service:**
   ```bash
   uv run python app.py
   ```

   Or activate the virtual environment:
   ```bash
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   python app.py
   ```

## API Endpoints

### Health Check
```http
GET /health
```

### Parse Land Law PDF
```http
POST /parse-pdf
Content-Type: application/json

{
  "max_pages": 100
}
```

### Parse PDF by Upload
```http
POST /parse-pdf-upload
Content-Type: multipart/form-data

file: [PDF file]
max_pages: 100 (optional)
```

## Response Format

```json
{
  "success": true,
  "chunks": [
    {
      "page_content": "Article content text...",
      "metadata": {
        "law_id": "133/VBHN-VPQH",
        "article_id": "1",
        "article_title": "Article title",
        "chunk_id": "law_133/VBHN-VPQH_art_1",
        "chunk_type": "full_article",
        "page_number": [1, 2],
        "coordinates": [...],
        ...
      }
    }
  ],
  "total_chunks": 890,
  "message": "Successfully parsed 890 chunks"
}
```

## Configuration

Environment variables:
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8001)
- `PYTHONPATH`: Python path (default: /app)

## Integration with Backend

The backend TypeScript service calls this parser service via HTTP:

```typescript
// Backend calls parser service
const response = await fetch('http://localhost:8001/parse-pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ max_pages: 100 }) // optional
})

const result = await response.json()
// Convert to LangChain Documents for vector store ingestion
```

## File Structure

```
parser/
├── app.py                 # FastAPI application
├── land_law_parser.py     # Core PDF parsing logic
├── Dockerfile             # Container configuration
├── docker-compose.yml     # Service orchestration
├── requirements.txt       # Python dependencies
├── 133-vbhn-vpqh.pdf     # Source PDF file
└── law_content_page_128.json # Additional content
```

## Development

1. **Run in development mode:**
   ```bash
   uv run uvicorn app:app --reload --host 0.0.0.0 --port 8001
   ```

2. **View API documentation:**
   - Swagger UI: http://localhost:8001/docs
   - ReDoc: http://localhost:8001/redoc

3. **Test the service:**
   ```bash
   curl -X GET http://localhost:8001/health
   ```

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   docker-compose down
   # Or change port in docker-compose.yml
   ```

2. **PDF file not found:**
   - Ensure PDF files are mounted correctly in docker-compose.yml
   - Check file paths in volume mappings

3. **Memory issues with large PDFs:**
   - Increase Docker memory limits
   - Use `max_pages` parameter to limit processing

### Logs

View service logs:
```bash
docker-compose logs -f land-law-parser
```

## Performance

- **Processing Time**: ~30-60 seconds for full 304-page document
- **Memory Usage**: ~200-500MB depending on PDF size
- **Output**: ~890 structured chunks from the Land Law document
- **Concurrent Requests**: Supports multiple simultaneous PDF processing requests

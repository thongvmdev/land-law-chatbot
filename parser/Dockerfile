# Single-stage build for Python Land Law Parser Service using uv
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies for PyMuPDF and uv
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    curl \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Copy project files
COPY pyproject.toml uv.lock ./

# Install dependencies with uv
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY . .

# Make sure virtual environment is in PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV VIRTUAL_ENV="/app/.venv"

# Debug: Check what's in the virtual environment
RUN echo "=== Checking virtual environment ===" && \
    ls -la /app/.venv/ && \
    echo "=== Checking bin directory ===" && \
    ls -la /app/.venv/bin/ && \
    echo "=== Checking Python path ===" && \
    which python && \
    echo "=== Testing uvicorn import ===" && \
    python -c "import sys; print('Python path:', sys.path)" && \
    python -c "import uvicorn; print('uvicorn found')" || echo "uvicorn not found"

# Create directory for PDF files
RUN mkdir -p /app/data

# Set environment variables
ENV PYTHONPATH=/app
ENV HOST=0.0.0.0
ENV PORT=8001

# Expose port
EXPOSE 8001

# Run the application using uv run
CMD ["uv", "run", "python", "app.py"]
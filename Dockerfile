# ==============================================================================
# SPARKMARG DOCKER CONTAINER CONFIGURATION
# Multi-stage lightweight Python deployment
# ==============================================================================

FROM python:3.11-slim AS builder

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Final runtime stage
FROM python:3.11-slim

WORKDIR /app

# Copy built virtual environment dependencies from builder stage
COPY --from=builder /install /usr/local

# Copy application source code
COPY . .

# Non-root unprivileged user creation for runtime execution security
RUN useradd -m sparkuser && chown -R sparkuser:sparkuser /app
USER sparkuser

# Expose production port
EXPOSE 5000

# Healthcheck probe to monitor instance status
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/')" || exit 1

# Default execution entrypoint utilizing WSGI Gunicorn server
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--threads", "2", "app:app"]
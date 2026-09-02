# ========================================================================
# VaceUp LMS - Multi-stage Docker Build
# ========================================================================

# ========================================================================
# BASE IMAGE - Python 3.12 slim
# ========================================================================
FROM python:3.12-slim AS base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    libpng-dev \
    libwebp-dev \
    libffi-dev \
    libssl-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r vaceup && useradd -r -g vaceup vaceup

# Set work directory
WORKDIR /app

# ========================================================================
# DEPENDENCIES STAGE
# ========================================================================
FROM base AS dependencies

# Copy requirements first for better caching
COPY requirements.txt .
COPY requirements-dev.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# ========================================================================
# BUILD STAGE
# ========================================================================
FROM dependencies AS build

# Copy application code
COPY . .

# Collect static files
ENV DJANGO_SETTINGS_MODULE=config.settings
RUN python manage.py collectstatic --noinput --settings=config.settings

# ========================================================================
# PRODUCTION STAGE
# ========================================================================
FROM base AS production

# Copy installed dependencies from dependencies stage
COPY --from=dependencies /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

# Copy application code from build stage
COPY --from=build /app /app

# Create directories for static/media files
RUN mkdir -p /app/staticfiles /app/media && \
    chown -R vaceup:vaceup /app

# Switch to non-root user
USER vaceup

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/healthz/ || exit 1

# Run the application
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120"]
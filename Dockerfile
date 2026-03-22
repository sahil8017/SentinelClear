FROM python:3.11-slim

WORKDIR /app
ENV PYTHONPATH=/app

# Install deps first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .

# Copy trained ML model (if available at build time)
# The model/ dir is also bind-mounted in docker-compose for hot-swap
COPY model/ model/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

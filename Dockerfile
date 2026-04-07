FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app

# Install deps first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .

# ML model artifacts are bundled with app/ml/
# Ensure fraud_model.pkl and scaler.pkl are present after training

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

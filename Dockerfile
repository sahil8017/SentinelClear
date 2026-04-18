# Stage 1: Builder
FROM python:3.12-slim as builder

WORKDIR /app
COPY requirements.txt .
# Install dependencies into a local directory
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Final
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app

# Copy only the installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .

# Exclude training scripts and data but keep the trained model
RUN rm -rf app/ml/data/ app/ml/train_loan_model.py app/ml/generate_dataset.py

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

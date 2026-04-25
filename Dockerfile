FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY tests/ tests/

# Exclude training scripts and data but keep the trained model
RUN rm -rf app/ml/data/ app/ml/train_loan_model.py app/ml/generate_dataset.py

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

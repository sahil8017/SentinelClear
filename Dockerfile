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
COPY worker/ worker/
COPY start.sh .

# Ensure line endings are LF for Linux and make start.sh executable
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

# Exclude training scripts and data but keep the trained model
RUN rm -rf app/ml/data/ app/ml/train_loan_model.py app/ml/generate_dataset.py

# Make the app directory writable for Hugging Face non-root user (user 1000)
RUN chmod -R 777 /app

EXPOSE 7860
CMD ["./start.sh"]

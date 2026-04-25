FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app

# Install dependencies
COPY requirements-worker.txt .
RUN pip install --no-cache-dir -r requirements-worker.txt

# Copy application code
COPY app/ app/
COPY worker/ worker/

# Remove unnecessary parts of app that worker doesn't need
RUN rm -rf app/ml/ app/routers/ 

CMD ["python", "-m", "worker.consumer"]

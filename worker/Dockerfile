FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app package (needed for config, models, database imports)
COPY app/ app/
# Copy consumer script
COPY worker/ worker/

CMD ["python", "-m", "worker.consumer"]

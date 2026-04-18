# Stage 1: Builder
FROM python:3.12-slim as builder

WORKDIR /app
COPY requirements-worker.txt .
# Install dependencies into a local directory
RUN pip install --no-cache-dir --prefix=/install -r requirements-worker.txt

# Stage 2: Final
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app

# Copy only the installed packages from builder
COPY --from=builder /install /usr/local

# Copy app package and consumer script
COPY app/ app/
COPY worker/ worker/

# Remove unnecessary parts of app that worker doesn't need
RUN rm -rf app/ml/ app/routers/ 

CMD ["python", "-m", "worker.consumer"]

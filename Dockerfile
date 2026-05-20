FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/. .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONPATH=/app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY tests/ tests/
COPY worker/ worker/
COPY start.sh .
# Copy built frontend assets
COPY --from=frontend-builder /frontend/dist ./frontend/dist
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh
RUN rm -rf app/ml/data/ app/ml/train_loan_model.py app/ml/generate_dataset.py
RUN chmod -R 777 /app
EXPOSE 7860
CMD ["./start.sh"]

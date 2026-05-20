FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/. .

# Explicitly mount Hugging Face Secrets and expose them to Vite during the build
RUN --mount=type=secret,id=VITE_FIREBASE_API_KEY,mode=0444,required=true \
    --mount=type=secret,id=VITE_FIREBASE_AUTH_DOMAIN,mode=0444,required=true \
    --mount=type=secret,id=VITE_FIREBASE_PROJECT_ID,mode=0444,required=true \
    --mount=type=secret,id=VITE_FIREBASE_STORAGE_BUCKET,mode=0444,required=true \
    --mount=type=secret,id=VITE_FIREBASE_MESSAGING_SENDER_ID,mode=0444,required=true \
    --mount=type=secret,id=VITE_FIREBASE_APP_ID,mode=0444,required=true \
    export VITE_FIREBASE_API_KEY=$(cat /run/secrets/VITE_FIREBASE_API_KEY) && \
    export VITE_FIREBASE_AUTH_DOMAIN=$(cat /run/secrets/VITE_FIREBASE_AUTH_DOMAIN) && \
    export VITE_FIREBASE_PROJECT_ID=$(cat /run/secrets/VITE_FIREBASE_PROJECT_ID) && \
    export VITE_FIREBASE_STORAGE_BUCKET=$(cat /run/secrets/VITE_FIREBASE_STORAGE_BUCKET) && \
    export VITE_FIREBASE_MESSAGING_SENDER_ID=$(cat /run/secrets/VITE_FIREBASE_MESSAGING_SENDER_ID) && \
    export VITE_FIREBASE_APP_ID=$(cat /run/secrets/VITE_FIREBASE_APP_ID) && \
    npm run build

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
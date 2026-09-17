FROM node:20-slim AS panel
WORKDIR /panel
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY backend/pyproject.toml backend/poetry.lock ./
RUN pip install poetry==1.8.3 && poetry config virtualenvs.create false && poetry install --only main --no-root
COPY backend/app ./app
COPY backend/data ./data
COPY --from=panel /panel/dist ./web
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

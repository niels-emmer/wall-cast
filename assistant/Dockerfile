FROM python:3.12-slim

RUN pip install --no-cache-dir httpx pyyaml

COPY . /app
WORKDIR /app

CMD ["python", "assistant.py"]

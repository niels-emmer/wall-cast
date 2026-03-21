FROM python:3.12-slim

RUN pip install --no-cache-dir catt pyyaml

COPY cast.py /cast.py
COPY scanner.py /scanner.py

CMD ["python", "/cast.py"]

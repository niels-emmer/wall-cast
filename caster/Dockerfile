FROM python:3.12-slim

RUN pip install --no-cache-dir catt pyyaml androidtvremote2 wakeonlan

COPY cast.py /cast.py
COPY scanner.py /scanner.py
COPY remote.py /remote.py
COPY pair.py /pair.py

CMD ["python", "/cast.py"]

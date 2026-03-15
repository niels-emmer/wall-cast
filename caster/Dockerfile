FROM python:3.12-slim

RUN pip install --no-cache-dir catt

COPY cast.sh /cast.sh
RUN chmod +x /cast.sh

CMD ["/cast.sh"]

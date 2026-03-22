"""In-memory log buffer for the /api/admin/logs endpoint."""
import logging
from collections import deque
from datetime import datetime
from typing import Any

_buffer: deque[dict[str, Any]] = deque(maxlen=50)


class _BufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            _buffer.append({
                "ts": datetime.fromtimestamp(record.created).strftime("%H:%M:%S"),
                "level": record.levelname,
                "name": record.name,
                "msg": self.format(record),
            })
        except Exception:
            pass


_handler = _BufferHandler()
_handler.setLevel(logging.WARNING)
_formatter = logging.Formatter("%(message)s")
_handler.setFormatter(_formatter)


def install() -> None:
    """Attach the buffer handler to the root logger."""
    logging.getLogger().addHandler(_handler)


def get_records() -> list[dict[str, Any]]:
    return list(_buffer)

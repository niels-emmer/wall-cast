"""Shared types for assistant rules."""

from dataclasses import dataclass, field


@dataclass
class Notification:
    title: str
    message: str
    person_id: str | None = None   # None = send to the global/shared topic
    priority: str = "default"      # ntfy priorities: min low default high urgent
    tags: list[str] = field(default_factory=list)

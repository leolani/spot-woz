import dataclasses
from typing import Optional


@dataclasses.dataclass
class GameEvent:
    participant_id: Optional[str] = None
    round: Optional[str] = None
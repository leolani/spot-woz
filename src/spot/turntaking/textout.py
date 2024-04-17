import logging
from typing import List, Tuple, Optional

import requests
from cltl.backend.api.gestures import GestureType
from cltl.backend.source.remote_tts import AnimatedRemoteTextOutput

logger = logging.getLogger(__name__)


class TurnTakingTextOutput(AnimatedRemoteTextOutput):
    def __init__(self, remote_url: str,
                 gestures: List[GestureType] = None,
                 color_talk: Tuple[float, float, float] = (0.8, 0.0, 0.8),
                 color_listen: Tuple[float, float, float] = (0.7, 1.0, 0.4)):
        super().__init__(remote_url, gestures)
        self._led_talk = self._gesture_command(gestures) + self._color_command(color_talk)
        self._led_listen = f"{self._rotate_command(color_listen, color_talk)} {self._color_command(color_listen)}"

        try:
            requests.delete(f"{remote_url}/behaviour/autonomous_visual_feedback")
        except:
            logger.exception("Failed to set autonomous_visual_feedback behaviour")

    def consume(self, text: str, language: Optional[str] = None):
        super().consume(f"{self._led_talk} {text} {self._led_listen}", language)

    @staticmethod
    def _color_command(color: Tuple[float, float, float], color_base: Tuple[float, float, float]):
        color = color if color else color_base
        return f"^pCall(ALLeds.fadeRGB(\"FaceLeds\", {color[0]}, {color[1]}, {color[2]}, 0.1))"

    @staticmethod
    def _rotate_command(color_listen: Tuple[float, float, float], color_talk: Tuple[float, float, float]):
        if color_listen == color_talk:
            return ""

        int_color = int(color_listen[0] * 256 ** 3 + color_listen[1] * 256 ** 2 + color_listen[2] * 256)

        return f"^pCall(ALLeds.rotateEyes({int_color}, 0.5, 0.5))"

    @staticmethod
    def _gesture_command(gestures):
        return "^mode(disabled) " if not gestures or gestures == [GestureType.DO_NOTHING] else ""

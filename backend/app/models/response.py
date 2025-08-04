from typing import List

from pydantic import BaseModel


class PitchResponse(BaseModel):
    time: List[float]
    pitch: List[float]
    message: str

"""Response models for the public API."""

from pydantic import BaseModel, Field


class PitchResponse(BaseModel):
    """A pitch contour: parallel arrays of timestamps and frequencies.

    ``pitch[i]`` is 0 where frame ``i`` is unvoiced, which the client renders as a
    gap rather than a line to the floor.
    """

    time: list[float] = Field(description="Frame timestamps in seconds")
    pitch: list[float] = Field(description="Fundamental frequency in Hz, 0 if unvoiced")
    voicedFraction: float = Field(
        description="Share of frames carrying pitch; low values mean a noisy recording"
    )


class ReferenceResponse(BaseModel):
    """Reference audio for a phrase, plus its pitch contour."""

    audioUrl: str
    pitch: PitchResponse

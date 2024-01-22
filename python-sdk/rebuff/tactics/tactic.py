from typing import Dict, Any, Optional

from abc import ABC, abstractmethod
from pydantic import BaseModel


class TacticExecution(BaseModel):
    score: float
    """
    A score between 0 and 1, inclusive, representing the likelihood that the input is prompt
    injection. The closer to 1, the more likely that is it prompt injection.
    """

    additional_fields: Optional[Dict[str, Any]] = None
    """
    Optional additional fields that can be used to return additional information about the
    execution of this tactic.
    """


class Tactic(ABC):
    name: str
    """
    The name of the tactic.
    """

    default_threshold: float
    """
    The threshold to use to determine if the tactic has detected prompt injection. At runtime,
    the caller can provide a different threshold to override the default.
    """

    @abstractmethod
    def execute(self, input: str, threshold_override: float) -> TacticExecution:
        """
        Execute the tactic on the given input.
        """
        pass

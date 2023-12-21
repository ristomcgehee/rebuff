import secrets
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import requests
from pydantic import BaseModel


class TacticName(str, Enum):
    # A series of heuristics are used to determine whether the input is prompt injection.
    HEURISTIC = "heuristic"
    # A language model is asked if the input appears to be prompt injection.
    VECTOR_DB = "vector_db"
    # A vector database of known prompt injection attacks is queried for similarity.
    LANGUAGE_MODEL = "language_model"


class TacticOverride(BaseModel):
    # The name of the tactic to override.
    name: TacticName
    # The threshold to use for this tactic. If the score is above this threshold, the tactic will be considered
    # detected. If not specified, the default threshold for the tactic will be used.
    threshold: Optional[float] = None
    # Whether to run this tactic.
    run: bool = True


class DetectApiRequest(BaseModel):
    # The user input to check for prompt injection.
    userInput: str
    # The base64-encoded user input. If this is specified, the user input will be ignored.
    userInputBase64: Optional[str] = None
    # Any tactics to change behavior for. If any tactic is not specified, the default threshold for that tactic will be
    # used.
    tacticOverrides: List[TacticOverride] = []


class TacticResult(BaseModel):
    # The name of the tactic.
    name: TacticName
    # The score for the tactic. This is a number between 0 and 1. The closer to 1, the more likely that this is a
    # prompt injection attempt.
    score: float
    # Whether this tactic evaluated the input as a prompt injection attempt.
    detected: bool
    # The threshold used for this tactic. If the score is above this threshold, the tactic will be considered detected.
    threshold: float
    # Some tactics return additional fields:
    # * "vector_db":
    #   - "countOverMaxVectorScore" (int): The number of different vectors whose similarity score is above the
    #       threshold.
    additionalFields: Dict[str, Any]


class DetectApiSuccessResponse(BaseModel):
    # Whether prompt injection was detected.
    injectionDetected: bool
    # The result for each tactic that was executed.
    tacticResults: List[TacticResult]


class Rebuff:
    def __init__(
        self, api_token: str, api_url: str = "https://playground.rebuff.ai"
    ):
        self.api_token = api_token
        self.api_url = api_url
        self._headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    def detect_injection(
        self,
        user_input: str,
        tactic_overrides: List[TacticOverride] = [],
    ) -> DetectApiSuccessResponse:
        """
        Detects if the given user input contains an injection attempt.

        Args:
            user_input (str): The user input to be checked for injection.
            tactic_overrides (List[TacticOverride], optional): Any tactics to change the behavior for. These are the
                thresholds for the default tactics:
                - "heuristic": 0.75
                - "language_model": 0.9
                - "vector_db": 0.9

        Returns:
            DetectApiSuccessResponse: An object containing the detection results, including the scores for each tactic
                and a boolean indicating if an injection was detected.

        Examples:
            >>> detection_response = rebuff.detect_injection(user_input, [
            ...     TacticOverride(name=TacticName.HEURISTIC, threshold=0.85),
            ...     TacticOverride(name=TacticName.LANGUAGE_MODEL, threshold=0.7),
            ...     TacticOverride(name=TacticName.VECTOR_DB, run=False),
            ... ])

            >>> if detection_response.injectionDetected:
            ...     print("Possible injection detected. Take corrective action.")
        """
        request_data = DetectApiRequest(
            userInput=user_input,
            userInputBase64=encode_string(user_input),
            tacticOverrides=tactic_overrides,
        )

        response = requests.post(
            f"{self.api_url}/api/detect",
            json=request_data.dict(),
            headers=self._headers,
        )

        response.raise_for_status()

        response_json = response.json()
        return DetectApiSuccessResponse.parse_obj(response_json)

    @staticmethod
    def generate_canary_word(length: int = 8) -> str:
        """
        Generates a secure random hexadecimal canary word.

        Args:
            length (int, optional): The length of the canary word. Defaults to 8.

        Returns:
            str: The generated canary word.
        """
        return secrets.token_hex(length // 2)

    def add_canary_word(
        self,
        prompt: Any,
        canary_word: Optional[str] = None,
        canary_format: str = "<!-- {canary_word} -->",
    ) -> Tuple[Any, str]:
        """
        Adds a canary word to the given prompt which we will use to detect leakage.

        Args:
            prompt (Any): The prompt to add the canary word to.
            canary_word (Optional[str], optional): The canary word to add. If not provided, a random canary word will be
             generated. Defaults to None.
            canary_format (str, optional): The format in which the canary word should be added.
            Defaults to "<!-- {canary_word} -->".

        Returns:
            Tuple[Any, str]: A tuple containing the modified prompt with the canary word and the canary word itself.
        """

        # Generate a canary word if not provided
        if canary_word is None:
            canary_word = self.generate_canary_word()

        # Embed the canary word in the specified format
        canary_comment = canary_format.format(canary_word=canary_word)
        if isinstance(prompt, str):
            prompt_with_canary: str = canary_comment + "\n" + prompt
            return prompt_with_canary, canary_word

        try:
            import langchain

            if isinstance(prompt, langchain.PromptTemplate):
                prompt.template = canary_comment + "\n" + prompt.template
                return prompt, canary_word
        except ImportError:
            pass

        raise TypeError(
            f"prompt_template must be a PromptTemplate or a str, "
            f"but was {type(prompt)}"
        )

    def is_canary_word_leaked(
        self,
        user_input: str,
        completion: str,
        canary_word: str,
        log_outcome: bool = True,
    ) -> bool:
        """
        Checks if the canary word is leaked in the completion.

        Args:
            user_input (str): The user input.
            completion (str): The completion generated by the AI.
            canary_word (str): The canary word to check for leakage.
            log_outcome (bool, optional): Whether to log the outcome of the leakage check. Defaults to True.

        Returns:
            bool: True if the canary word is leaked, False otherwise.
        """
        if canary_word in completion:
            if log_outcome:
                self.log_leakage(user_input, completion, canary_word)
            return True
        return False

    def log_leakage(
        self, user_input: str, completion: str, canary_word: str
    ) -> None:
        """
        Logs the leakage of a canary word.

        Args:
            user_input (str): The user input.
            completion (str): The completion generated by the AI.
            canary_word (str): The leaked canary word.
        """
        data = {
            "user_input": user_input,
            "completion": completion,
            "canaryWord": canary_word,
        }
        response = requests.post(
            f"{self.api_url}/api/log", json=data, headers=self._headers
        )
        response.raise_for_status()
        return


def encode_string(message: str) -> str:
    return message.encode("utf-8").hex()

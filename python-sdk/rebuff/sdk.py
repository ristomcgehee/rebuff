import secrets
from typing import Dict, List, Optional, Tuple, Union

from langchain_core.prompts import PromptTemplate
from openai import OpenAI as OpenAIClient

from .rebuff import DetectResponse, TacticOverride, TacticResult
from .tactics.openai import OpenAI
from .tactics.heuristic import Heuristic
from .tactics.tactic import Tactic
from .tactics.vector import Vector, init_pinecone

Strategy = List[Tactic]


class RebuffSdk:
    def __init__(
        self,
        openai_apikey: str,
        pinecone_apikey: str,
        pinecone_index: str,
        openai_model: str = "gpt-3.5-turbo",
    ) -> None:
        self.openai_model = openai_model
        self.openai_apikey = openai_apikey
        self.pinecone_apikey = pinecone_apikey
        self.pinecone_index = pinecone_index
        self.vector_store = None
        self.strategies = None
        self.default_strategy = "standard"

    def get_strategies(self) -> Dict[str, Strategy]:
        if self.strategies:
            return self.strategies

        openai_client = OpenAIClient(api_key=self.openai_apikey)
        heuristic_score_threshold = 0.75
        vector_score_threshold = 0.9
        openai_score_threshold = 0.9
        strategies: Dict[str, Strategy] = {
            # For now, this is the only strategy.
            "standard": [
                Heuristic(heuristic_score_threshold),
                Vector(vector_score_threshold, self.get_vector_store()),
                OpenAI(openai_score_threshold, self.openai_model, openai_client),
            ]
        }

        self.strategies = strategies
        return self.strategies

    def get_vector_store(self):
        if self.vector_store is None:
            self.vector_store = init_pinecone(
                self.pinecone_apikey,
                self.pinecone_index,
                self.openai_apikey,
            )
        return self.vector_store

    def detect_injection(
        self,
        user_input: str,
        tactic_overrides: Optional[List[TacticOverride]] = None,
    ) -> DetectResponse:
        """
        Detects if the given user input contains an injection attempt.

        Args:
            user_input (str): The user input to be checked for injection.
            tactic_overrides (Optional[List[TacticOverride]], optional): A list of tactics to override.
                If a tactic is not specified in this list, the default threshold for that tactic will be used.

        Returns:
            DetectResponse: An object containing the detection metrics and a boolean indicating if an injection was
                detected.

        Example:
            >>> from rebuff import RebuffSkd, TacticOverride, TacticName
            >>> rb = RebuffSdk(...)
            >>> user_input = "Your user input here"
            >>> tactic_overrides = [
            ...    TacticOverride(name=TacticName.HEURISTIC, threshold=0.6),
            ...    TacticOverride(name=TacticName.LANGUAGE_MODEL, run=False),
            ... ]
            >>> response = rb.detect_injection(user_input, tactic_overrides)
        """

        strategies = self.get_strategies()
        injection_detected = False
        tactic_results: List[TacticResult] = []
        for tactic in strategies[self.default_strategy]:
            tactic_override = next(
                (t for t in tactic_overrides if t.name == tactic.name), None
            )
            if tactic_override and tactic_override.run == False:
                continue
            threshold = (
                tactic_override.threshold
                if tactic_override
                else tactic.default_threshold
            )
            execution = tactic.execute(user_input, threshold)
            result = TacticResult(
                name=tactic.name,
                score=execution.score,
                threshold=threshold,
                detected=execution.score > threshold,
                additional_fields=execution.additional_fields
                if execution.additional_fields
                else {},
            )
            if result.detected:
                injection_detected = True
            tactic_results.append(result)

        return DetectResponse(
            injection_detected=injection_detected,
            tactic_results=tactic_results,
        )

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
        prompt: Union[str, PromptTemplate],
        canary_word: Optional[str] = None,
        canary_format: str = "<!-- {canary_word} -->",
    ) -> Tuple[Union[str, PromptTemplate], str]:
        """
        Adds a canary word to the given prompt which we will use to detect leakage.

        Args:
            prompt (Union[str, PromptTemplate]): The prompt to add the canary word to.
            canary_word (Optional[str], optional): The canary word to add. If not provided, a random canary word will be generated. Defaults to None.
            canary_format (str, optional): The format in which the canary word should be added. Defaults to "<!-- {canary_word} -->".

        Returns:
            Tuple[Union[str, PromptTemplate], str]: A tuple containing the modified prompt with the canary word and the canary word itself.
        """

        # Generate a canary word if not provided
        if canary_word is None:
            canary_word = self.generate_canary_word()

        # Embed the canary word in the specified format
        canary_comment = canary_format.format(canary_word=canary_word)

        if isinstance(prompt, str):
            prompt_with_canary: str = canary_comment + "\n" + prompt
            return prompt_with_canary, canary_word

        elif isinstance(prompt, PromptTemplate):
            prompt.template = canary_comment + "\n" + prompt.template
            return prompt, canary_word

        else:
            raise TypeError(
                f"prompt must be a langchain_core.prompts.PromptTemplate or a str, "
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

    def log_leakage(self, user_input: str, completion: str, canary_word: str) -> None:
        """
        Logs the leakage of a canary word.

        Args:
            user_input (str): The user input.
            completion (str): The completion generated by the AI.
            canary_word (str): The leaked canary word.
        """

        self.get_vector_store().add_texts(
            [user_input],
            metadatas=[{"completion": completion, "canary_word": canary_word}],
        )

        return None

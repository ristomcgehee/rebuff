from typing import Optional

import pinecone
from langchain_community.vectorstores import Pinecone
from langchain_openai import OpenAIEmbeddings

from ..rebuff import TacticName
from .tactic import Tactic, TacticExecution


class Vector(Tactic):
    name = TacticName.VECTOR_DB

    def __init__(self, threshold: float, vector_store: Pinecone):
        self.default_threshold = threshold
        self.vector_store = vector_store

    def execute(self, input: str, threshold_override: float) -> TacticExecution:
        threshold = threshold_override or self.default_threshold
        top_k = 20
        results = self.vector_store.similarity_search_with_score(input, top_k)

        top_score = 0
        count_over_max_vector_score = 0

        for _, score in results:
            if score is None:
                continue

            if score > top_score:
                top_score = score

            if score >= threshold and score > top_score:
                count_over_max_vector_score += 1

        additional_fields = {"countOverMaxVectorScore": count_over_max_vector_score}
        return TacticExecution(score=top_score, additional_fields=additional_fields)


def init_pinecone(api_key: str, index: str, openai_api_key: str) -> Pinecone:
    """
    Initializes connection with the Pinecone vector database using existing (rebuff) index.

    Args:
        api_key (str): Pinecone API key
        index (str): Pinecone index name
        openai_api_key (str): Open AI API key

    Returns:
        vector_store (Pinecone)

    """
    if not api_key:
        raise ValueError("Pinecone apikey definition missing")

    pinecone.Pinecone(api_key=api_key)

    openai_embeddings = OpenAIEmbeddings(
        openai_api_key=openai_api_key, model="text-embedding-ada-002"
    )

    vector_store = Pinecone.from_existing_index(
        index, openai_embeddings, text_key="input"
    )

    return vector_store

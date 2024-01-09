import os
import sys
import json

import wandb

from rebuff import RebuffSdk

def get_env_value(env_name: str) -> str:
    try:
        return os.environ[env_name]
    except KeyError:
        print(f"Missing environment variable: {env_name}")
        sys.exit(1)

rb = RebuffSdk(
    openai_model="gpt-3.5-turbo",
    openai_apikey=get_env_value("OPENAI_API_KEY"),
    pinecone_apikey=get_env_value("PINECONE_API_KEY"),
    pinecone_environment=get_env_value("PINECONE_ENVIRONMENT"),
    pinecone_index=get_env_value("PINECONE_INDEX_NAME"),
)

wandb.init(project="trace-example")

benign_inputs = json.load(open("data/benign_inputs.json"))
malicious_inputs = json.load(open("data/malicious_inputs.json"))

for input in benign_inputs + malicious_inputs:
    print("=" * 80)
    print(input)
    print(rb.detect_injection(input, check_vector=False, check_heuristic=False))

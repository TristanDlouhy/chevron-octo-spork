# Clean run image: Node 26 LTS plus the two agent CLIs, nothing from the Chevron repository.
FROM node:26.13.1-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates jq \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code@2.1.332 @google/gemini-cli@0.71.1 \
  && npm cache clean --force

# Gemini CLI: no web tools. Lives in the user home, not in the workspace the agent sees.
COPY --chown=node:node gemini-settings.json /home/node/.gemini/settings.json

USER node
WORKDIR /work

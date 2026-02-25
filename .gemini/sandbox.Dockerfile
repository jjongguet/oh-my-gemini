# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim

# Core runtime dependencies for Gemini sandbox smoke checks
RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates curl git tmux \
    && rm -rf /var/lib/apt/lists/*

# Gemini CLI is installed at runtime in host environments too; this image is a baseline.
RUN npm install -g @google/gemini-cli@latest

WORKDIR /workspace

# Default shell used by smoke scripts
CMD ["bash"]

FROM node:20-slim AS node

FROM python:3.11-slim

COPY --from=node /usr/local /usr/local

RUN python3 -m pip install --no-cache-dir hermes-agent

WORKDIR /workspace

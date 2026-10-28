FROM python:3.12-slim-trixie
# JuPedSim has no Linux ARM64 wheel; build the locked version from source.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake libgmp-dev libmpfr-dev libboost-dev && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.11.16 /uv /uvx /usr/local/bin/
WORKDIR /workspace/engine
ENV UV_LINK_MODE=copy
COPY engine/pyproject.toml engine/uv.lock ./
RUN uv sync --frozen --no-dev && uv cache clean
COPY engine/ ./
COPY fixtures/ /workspace/fixtures/
EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

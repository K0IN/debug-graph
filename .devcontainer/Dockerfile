FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install additional tools useful for VS Code extension development
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    # For native modules and build tools
    build-essential \
    python3 \
    # For git operations
    git \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

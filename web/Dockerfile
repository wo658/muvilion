FROM node:24-bookworm-slim
RUN npm install --global pnpm@11.2.2
WORKDIR /workspace/web
ENV NEXT_TELEMETRY_DISABLED=1
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
COPY fixtures/ /workspace/fixtures/
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start", "--hostname", "0.0.0.0", "--port", "3000"]

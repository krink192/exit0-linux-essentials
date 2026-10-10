# SPDX-License-Identifier: GPL-3.0-or-later
# exit 0 as a container: the static web app served by nginx, running as a non-root user on port 8080.
#   docker run -d -p 8080:8080 ghcr.io/krink192/exit0
# Built and published by .github/workflows/docker.yml on every release (linux/amd64 and linux/arm64).
FROM nginxinc/nginx-unprivileged:stable-alpine

LABEL org.opencontainers.image.title="exit 0" \
      org.opencontainers.image.description="Free practice for LPI Linux Essentials 010-160: exam and study modes, flashcards, progress tracking" \
      org.opencontainers.image.source="https://github.com/krink192/exit0-linux-essentials" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docs/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

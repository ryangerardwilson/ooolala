FROM hexpm/elixir:1.19.5-erlang-28.1.1-debian-bookworm-20260518-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential ca-certificates git \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/backend

COPY VERSION /app/VERSION
COPY apps/backend/mix.exs ./mix.exs
COPY apps/backend/config ./config
COPY apps/backend/main.ex ./main.ex
COPY apps/backend/lib ./lib

RUN MIX_ENV=prod mix release backend

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libncurses6 libstdc++6 openssl postgresql-client \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /app/apps/backend/_build/prod/rel/backend ./

ENV PORT=4000
ENV OOOLALA_BACKEND_HTTP=1
ENV LANG=C.UTF-8
EXPOSE 4000

CMD ["/app/bin/backend", "start"]

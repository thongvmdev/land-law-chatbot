FROM langchain/langgraphjs-api:20
ENV CI=true
ADD . /deps/backend
ENV LANGSERVE_GRAPHS='{"chat":"./src/graph/index.ts:landLawGraph"}'
WORKDIR /deps/backend
RUN pnpm i --frozen-lockfile
RUN (test ! -f /api/langgraph_api/js/build.mts && echo "Prebuild script not found, skipping") || tsx /api/langgraph_api/js/build.mts
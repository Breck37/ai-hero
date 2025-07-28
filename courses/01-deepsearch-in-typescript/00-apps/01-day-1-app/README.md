## TODO

Do related followup questions.

Handle anonymous requests to the API, rate limit by IP.

Use a chunking system on the crawled information.

Add 'edit' button, and 'rerun from here' button.

Add evals.

Handle conversations longer than the context window by summarizing.

How do you get the LLM to ask followup questions?

## Setup

1. Install dependencies with `pnpm`

```bash
pnpm install
```

2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

3. Set up your environment variables in a `.env` file:

```bash
# Required API Keys
TAVILY_API_KEY=your_tavily_api_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key_here
SERPER_API_KEY=your_serper_api_key_here

# Database and Redis
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
REDIS_URL=redis://localhost:6379

# Authentication (Discord OAuth)
AUTH_DISCORD_ID=your_discord_client_id
AUTH_DISCORD_SECRET=your_discord_client_secret
AUTH_SECRET=your_auth_secret

# Langfuse (optional, for observability)
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_BASEURL=https://cloud.langfuse.com

# Configuration
SEARCH_RESULTS_COUNT=5
NODE_ENV=development
```

4. Start server: `pnpm dev`

5. Run `./start-database.sh` to start the database.

After initialized, use `pnpm db:studio`

5. Run `./start-redis.sh` to start the Redis server.

6. Test the Tavily integration:

```bash
node test-tavily.js
```

If using mcp tools: `npx @modelcontextprotocol/server-everything sse`

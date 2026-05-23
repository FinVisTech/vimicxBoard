# Vimicx Board

Stupid-simple Kanban for the Vimicx team. Discord is the first-class capture path: mention `@board`, say the task naturally, and the backend turns it into a validated board action.

## Stack

- Next.js + TypeScript
- Tailwind CSS with small local shadcn-style primitives
- Prisma + PostgreSQL
- Discord.js worker
- OpenAI-compatible LLM abstraction
- Zod validation for every model/API boundary

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set at least:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vimicx_board"
OPENAI_API_KEY="..."
DISCORD_BOT_TOKEN="..."
DISCORD_CLIENT_ID="..."
DISCORD_GUILD_ID="..."
DISCORD_CHANNEL_ID="..."
NEXTAUTH_SECRET="replace-me"
CRON_SECRET="replace-me"
```

3. Create/update the database and seed sample Vimicx data:

```bash
npm run db:push
npm run db:seed
```

4. Run the web app:

```bash
npm run dev
```

5. Run the Discord worker in a second terminal:

```bash
npm run bot:dev
```

Open `http://localhost:3000/board`.

`/settings` is protected in production with simple Basic/Bearer auth. Use any username and `NEXTAUTH_SECRET` as the password, or send `Authorization: Bearer $NEXTAUTH_SECRET`.

## Discord Bot Setup

1. Create an app in the Discord Developer Portal.
2. Add a bot and copy its token into `DISCORD_BOT_TOKEN`.
3. Enable Message Content Intent for the bot.
4. Invite the bot with permissions to read messages and send messages.
5. Mention it in a configured guild/channel:

```text
@board add task for Dalton to test turret yaw calibration before Friday
@board create card: Luke needs to call 3 marine electronics dealers tomorrow
@board move "Jetson setup" to In Progress
@board assign "Dealer demo script" to Luke
@board what is Dalton working on?
@board summarize today
@board blockers
```

## Daily Digest

Preview digest:

```bash
curl http://localhost:3000/api/digest
```

Send digest to Discord:

```bash
curl -X POST "http://localhost:3000/api/digest/send?secret=replace-me"
```

Cron target for Vercel/Railway:

```text
POST /api/digest/send?secret=$CRON_SECRET
```

## Deployment

### Vercel Web App

1. Provision Postgres through Vercel, Neon, Supabase, or Railway.
2. Set every variable in `.env.example`.
3. Use build command:

```bash
npm run build
```

4. After first deploy, run:

```bash
npm run db:push
npm run db:seed
```

### Railway Web + Worker

Use two Railway services from the same repo:

- Web service: `npm run build` then `npm run start`
- Worker service: `npm run bot:dev`

Both services need the same database and Discord/LLM environment variables.

## API

- `POST /api/commands/parse`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/comments`
- `GET /api/boards/:id`
- `GET /api/digest`
- `POST /api/digest/send`
- `POST /api/agent/action`
- `POST /api/discord/interactions`

## Agent Interface

`POST /api/agent/action`

```json
{
  "agentName": "OpenClaw",
  "action": "CREATE_TASK",
  "payload": {
    "title": "Validate OpenClaw handoff",
    "columnName": "To Do",
    "priority": "MEDIUM"
  },
  "reasoningSummary": "OpenClaw noticed an untracked follow-up."
}
```

`UPDATE_TASK` and `MOVE_TASK` require `payload.confirmed = true` unless `AGENT_AUTO_APPLY=true`.

## Tests

```bash
npm test
```

The tests cover natural-language parsing and task service creation behavior.

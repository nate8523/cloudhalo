# CloudHalo

**Multi-tenant Azure cost management and monitoring platform for MSPs**

CloudHalo helps Managed Service Providers (MSPs) monitor Azure costs, prevent surprise bills, and optimize client infrastructure across multiple Azure tenants—all from one dashboard.

## 🚀 Features

- ✅ **Multi-Tenant Management**: Connect and monitor unlimited Azure client tenants
- ✅ **Cost Monitoring**: Real-time visibility into Azure spending with daily granularity
- ✅ **Proactive Alerts**: Get notified when costs spike before they become surprise bills
- ✅ **Resource Discovery**: Complete inventory of all Azure resources
- ✅ **Optimization Recommendations**: AI-powered insights to reduce costs and improve efficiency
- 🔜 **Multi-Channel Notifications**: Email, Teams, and Slack integrations

## 📋 Prerequisites

- Node.js 20+
- Supabase account (database + auth)
- Azure service principal credentials (for your test tenant)

## 🏗️ Architecture

CloudHalo consists of two main components:

1. **Next.js Frontend** (`/src`): User interface, API routes, authentication
2. **Background Worker** (`/worker`): Azure API polling, cost data ingestion, scheduled jobs

```
┌─────────────────┐         ┌──────────────────┐
│   Next.js App   │────────▶│    Supabase      │
│   (Vercel)      │         │  (PostgreSQL)    │
└─────────────────┘         └──────────────────┘
                                     ▲
                                     │
                            ┌────────┴────────┐
                            │ Background      │
                            │ Worker          │
                            │ (Railway/Render)│
                            └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │  Azure APIs     │
                            │ - Cost Mgmt     │
                            │ - Resource Graph│
                            └─────────────────┘
```

## 🛠️ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/cloudhalo.git
cd cloudhalo
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install worker dependencies
cd worker
npm install
cd ..
```

### 3. Set Up Environment Variables

**Frontend** (`.env.local` in root):
```bash
cp .env.example .env.local
```

Add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
AZURE_CREDENTIAL_ENCRYPTION_KEY=your_64_char_hex_key_here
```

**Worker** (`worker/.env`):
```bash
cd worker
cp .env.example .env
```

Add your Supabase service role key:
```env
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
AZURE_CREDENTIAL_ENCRYPTION_KEY=same_64_char_hex_key_as_frontend
```

### 4. Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use this key for `AZURE_CREDENTIAL_ENCRYPTION_KEY` in **both** `.env.local` and `worker/.env`.

### 5. Set Up Supabase Database

Run the migrations in your Supabase project:

```sql
-- Copy the schema from src/types/database.ts
-- Or use Supabase migration files (if you have them)
```

### 6. Run Development Servers

**Terminal 1 - Frontend**:
```bash
npm run dev
# Opens at http://localhost:3000
```

**Terminal 2 - Worker**:
```bash
cd worker
npm run dev
# Health check at http://localhost:3001/health
```

### 7. Create Your First Account

1. Navigate to http://localhost:3000
2. Click "Sign Up"
3. Create an account
4. Connect your first Azure tenant using the setup wizard

## 📁 Project Structure

```
cloudhalo/
├── src/                          # Next.js application
│   ├── app/                      # App router pages
│   │   ├── (auth)/              # Auth pages (login, signup)
│   │   ├── dashboard/           # Dashboard pages
│   │   └── api/                 # API routes
│   ├── components/              # React components
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── dashboard/           # Dashboard-specific
│   │   ├── azure/               # Azure integration
│   │   └── alerts/              # Alert management
│   ├── lib/                     # Utilities
│   │   ├── supabase/           # Supabase clients
│   │   ├── azure/              # Azure SDK wrappers
│   │   └── encryption/         # Credential encryption
│   └── types/                   # TypeScript types
│
├── worker/                       # Background worker service
│   ├── src/
│   │   ├── tasks/              # Cron job tasks
│   │   │   └── poll-costs.ts   # Cost polling logic
│   │   ├── lib/                # Utilities
│   │   │   ├── azure-cost-client.ts  # Azure Cost API
│   │   │   ├── supabase.ts     # Database client
│   │   │   ├── encryption.ts   # Credential decryption
│   │   │   └── logger.ts       # Logging
│   │   └── index.ts            # Main entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile              # Docker build
│   ├── railway.json            # Railway config
│   └── render.yaml             # Render config
│
├── public/                      # Static assets
├── CLAUDE.md                    # Project instructions for Claude Code
├── MVP-PRD.md                   # Product Requirements Document
└── README.md                    # This file
```

## 🚢 Deployment

### Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Environment variables to set in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `AZURE_CREDENTIAL_ENCRYPTION_KEY`

### Worker (Railway - Recommended)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
cd worker
railway login
railway init
railway up
```

Environment variables to set in Railway dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AZURE_CREDENTIAL_ENCRYPTION_KEY`
- `NODE_ENV=production`

See [worker/README.md](worker/README.md) for detailed deployment instructions.

## 🔐 Security

- **Credential Encryption**: All Azure client secrets encrypted with AES-256-GCM
- **Row-Level Security**: Supabase RLS enforces multi-tenant data isolation
- **Read-Only Access**: Azure service principals have Reader + Monitoring Reader roles only
- **Environment Variables**: Secrets never committed to git

## 📚 Documentation

- **[MVP-PRD.md](MVP-PRD.md)**: Complete product requirements and feature specifications
- **[CLAUDE.md](CLAUDE.md)**: Project overview and development guidelines
- **[worker/README.md](worker/README.md)**: Background worker documentation
- **[docs/OPTIMIZATION_RECOMMENDATIONS.md](docs/OPTIMIZATION_RECOMMENDATIONS.md)**: Optimization recommendations feature guide

## 🧪 Testing

```bash
# Frontend
npm run lint
npm run type-check

# Worker
cd worker
npm run type-check
```

## 🛣️ Roadmap

See [MVP-PRD.md](MVP-PRD.md) for the complete 12-week development roadmap.

**Current Status (Revision 0.2a)**:
- ✅ Authentication & tenant onboarding (100% complete)
- ✅ Background worker service (100% complete)
- ✅ Cost monitoring dashboard (100% complete)
- ✅ Resource discovery (100% complete)
- ✅ Optimization recommendations (100% complete)
- 🔜 Proactive cost alerting (In progress)
- 🔜 Multi-channel notifications (Planned)

## 💡 Development Tips

### Common Commands

```bash
# Frontend dev server with hot reload
npm run dev

# Build frontend for production
npm run build

# Start production frontend
npm start

# Worker dev server with auto-reload
cd worker && npm run dev

# Build worker
cd worker && npm run build
```

### Database Queries

Useful queries for development:

```sql
-- Check connected tenants
SELECT id, name, connection_status, last_sync_at
FROM azure_tenants;

-- View cost data
SELECT
  date,
  SUM(cost_usd) as total_cost,
  COUNT(*) as record_count
FROM cost_snapshots
GROUP BY date
ORDER BY date DESC
LIMIT 7;

-- Check alert rules
SELECT * FROM alert_rules;
```

### Health Checks

```bash
# Frontend (when running)
curl http://localhost:3000/api/health

# Worker
curl http://localhost:3001/health
```

## 🐛 Troubleshooting

### Worker not fetching costs?

1. Check logs: `cd worker && npm run dev`
2. Verify encryption key matches between frontend and worker
3. Check Azure service principal hasn't expired
4. Verify tenant `connection_status = 'connected'`

### Dashboard showing no data?

1. Verify worker is running and polling
2. Check `cost_snapshots` table has data: `SELECT COUNT(*) FROM cost_snapshots;`
3. Ensure you have actual Azure costs for current month

### Authentication errors?

1. Check Supabase credentials in `.env.local`
2. Verify Supabase RLS policies are enabled
3. Check middleware.ts is running

## 📄 License

MIT

## 🙋 Support

For issues and questions:
- Check documentation in `CLAUDE.md` and `MVP-PRD.md`
- Review worker logs for error details
- Open GitHub issue with full error details

---

**Built with**: Next.js 14, TypeScript, Supabase, Azure SDK, TailwindCSS, shadcn/ui

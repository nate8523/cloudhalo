# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CloudHalo is a multi-tenant Azure cost management and monitoring platform built with Next.js 14, React 18, TypeScript, and Supabase. The application allows organizations to connect multiple Azure tenants, monitor costs, track resources, and set up alerts for Azure spending.

## Core Technologies

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Authentication**: Supabase Auth with SSR
- **UI**: React 18, Tailwind CSS 4, Radix UI, shadcn/ui components
- **State Management**: Zustand (for UI state), TanStack Query (for server state)
- **Azure Integration**: @azure/identity, @azure/arm-* SDKs
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation
- **Testing**: Playwright

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Run database migrations (if needed)
npm run migrate
```

## Architecture Overview

### Authentication & Authorization Flow

The application uses Supabase Auth with a multi-tenant organization model:
- **middleware.ts**: Handles session refresh and route protection via `updateSession()` from `@/lib/supabase/middleware`
- Protected routes: Everything under `/dashboard/*`
- Public routes: `/login`, `/signup`, and static assets
- Auth redirects: Authenticated users are redirected from auth pages to `/dashboard`

Database structure:
- `organizations`: Top-level tenant container
- `users`: Linked to organizations via `org_id`
- `azure_tenants`: Azure connections per organization
- `cost_snapshots`: Cost data from Azure
- `alert_rules`: Cost alerting configuration

### Supabase Integration Pattern

The codebase uses three different Supabase client patterns depending on context:

1. **Server Components** (`src/lib/supabase/server.ts`):
   ```typescript
   import { createClient } from '@/lib/supabase/server'
   const supabase = await createClient()
   ```

2. **Client Components** (`src/lib/supabase/client.ts`):
   ```typescript
   import { createClient } from '@/lib/supabase/client'
   const supabase = createClient()
   ```

3. **Middleware** (`src/lib/supabase/middleware.ts`):
   - Used in `middleware.ts` for session management
   - Handles cookie-based auth token refresh

All clients are typed with `Database` from `src/types/database.ts`.

### Azure Integration Architecture

The app integrates with Azure through service principals with read-only permissions (Reader + Monitoring Reader roles):

**Setup Flow**:
1. `src/lib/azure/script-generator.ts`: Generates PowerShell scripts for creating Azure service principals
2. `src/components/azure/script-display.tsx`: Displays the generated script to users
3. `src/components/azure/tenant-connection-form.tsx`: Collects Azure credentials
4. `src/app/api/tenants/connect/route.ts`: Validates credentials and stores tenant connection

**Credential Security**:
- Azure client secrets are encrypted using AES-256-GCM via `src/lib/encryption/crypto.ts`
- Encryption key stored in `AZURE_CREDENTIAL_ENCRYPTION_KEY` environment variable
- Encrypted format: `iv:authTag:ciphertext`
- Wrapper functions in `src/lib/encryption/vault.ts` provide abstraction layer

**Azure SDKs Used**:
- `@azure/identity`: Authentication via `ClientSecretCredential`
- `@azure/arm-subscriptions`: Subscription discovery
- `@azure/arm-resources`: Resource enumeration
- `@azure/arm-costmanagement`: Cost data retrieval
- `@azure/arm-monitor`: Metrics and monitoring data
- `@azure/arm-resourcegraph`: Advanced resource queries

### API Route Structure

API routes follow Next.js App Router conventions in `src/app/api/`:

```
/api/tenants/connect          POST - Create new Azure tenant connection
/api/tenants/discover         POST - Discover Azure subscriptions
/api/tenants/validate         POST - Validate Azure credentials
/api/tenants/[id]             GET/PUT/DELETE - Manage specific tenant
/api/tenants/[id]/sync        POST - Sync cost data from Azure
```

All routes:
- Check authentication via `supabase.auth.getUser()`
- Verify user's `org_id` from `users` table
- Use Row Level Security (RLS) on Supabase tables
- Return consistent error format: `{ error: string, details?: any }`

### State Management

**Server State** (TanStack Query):
- `src/lib/providers/query-provider.tsx`: Global QueryClient configuration
- Default `staleTime`: 60 seconds
- `refetchOnWindowFocus`: disabled
- React Query DevTools enabled in development

**UI State** (Zustand):
- `src/hooks/use-sidebar-collapse.ts`: Sidebar collapse state
- Pattern: Create hooks that use Zustand stores for persistent UI preferences

### Component Architecture

**UI Components** (`src/components/ui/`):
- Based on shadcn/ui conventions
- Built with Radix UI primitives + Tailwind CSS
- Uses `class-variance-authority` for variant management
- Utility: `src/lib/utils.ts` exports `cn()` for className merging

**Feature Components**:
- `src/components/dashboard/`: Layout components (header, sidebar, layout client wrapper)
- `src/components/azure/`: Azure-specific forms and displays
- `src/components/tenant-sync-button.tsx`: Reusable tenant sync trigger

**Layout Pattern**:
- Server Component layout: `src/app/dashboard/layout.tsx` (auth check)
- Client wrapper: `src/components/dashboard/dashboard-layout-client.tsx` (interactive UI)
- This pattern keeps auth checks server-side while enabling client interactivity

### Routing Structure

```
/                              Landing page
/(auth)/login                  Login page (route group)
/(auth)/signup                 Signup page (route group)
/dashboard                     Main dashboard
/dashboard/tenants             Tenant list
/dashboard/tenants/new         Add new tenant wizard
/dashboard/tenants/[id]        Tenant detail/cost view
/dashboard/tenants/[id]/settings  Tenant configuration
/dashboard/settings            User/org settings
```

Route groups `(auth)` share a common layout without affecting URL structure.

## Environment Variables

Required variables in `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anonymous key

# Encryption
AZURE_CREDENTIAL_ENCRYPTION_KEY=  # 64-char hex string for AES-256
```

## Key Implementation Patterns

### Type Safety
- All database types defined in `src/types/database.ts`
- Use `Database['public']['Tables']['table_name']['Row']` for type inference
- Path aliases configured: `@/*` → `./src/*`

### Error Handling in API Routes
```typescript
// Always check auth first
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Check org membership
const { data: userData } = await supabase
  .from('users')
  .select('org_id')
  .eq('id', user.id)
  .single()
```

### Azure Credential Handling
```typescript
// Never store plaintext secrets
import { encryptSecret } from '@/lib/encryption/vault'
const encrypted = await encryptSecret(azureClientSecret)

// Always decrypt when using
import { decryptSecret } from '@/lib/encryption/vault'
const plaintext = await decryptSecret(storedSecret)
```

### Form Validation Pattern
```typescript
// Use React Hook Form + Zod schemas
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({ /* fields */ })
const form = useForm({ resolver: zodResolver(schema) })
```

## Testing

Playwright tests are configured:
```bash
# Run Playwright tests
npx playwright test

# Run in UI mode
npx playwright test --ui
```

## Important Notes

1. **Credential Security**: NEVER commit actual credentials. The encryption key in `.env.local` is for local development only.

2. **Migration Script**: The `npm run migrate` command references `scripts/run-migration.ts` which doesn't exist in the current structure. Database migrations should be handled via Supabase CLI or dashboard.

3. **Azure Permissions**: All Azure integrations use read-only service principals. The script generator in `src/lib/azure/script-generator.ts` explicitly creates Reader + Monitoring Reader roles only.

4. **Dark Mode**: Theme switching is handled by `next-themes` provider in `src/lib/providers/theme-provider.tsx`.

5. **PRD References**: Many files include PRD line number references in comments - these point to an external Product Requirements Document.

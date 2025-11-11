import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Manual cost sync endpoint
 * Called by "Sync Now" buttons in the UI
 * Syncs all tenants for the authenticated user's organization
 */

export async function POST() {
  console.log('[SYNC] Manual cost sync triggered')

  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single() as { data: { org_id: string } | null }

    if (!userData?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch tenants for this organization
    const { data: tenants, error: tenantsError } = await supabase
      .from('azure_tenants')
      .select('id')
      .eq('org_id', userData.org_id)
      .eq('connection_status', 'connected') as { data: { id: string }[] | null; error: any }

    if (tenantsError) {
      console.error('[SYNC] Error fetching tenants:', tenantsError)
      return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 })
    }

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({
        success: true,
        totalCostsIngested: 0,
        duration: 0,
        message: 'No connected tenants found'
      })
    }

    console.log(`[SYNC] Found ${tenants.length} tenant(s) to sync`)

    const startTime = Date.now()
    const results = []

    // Sync each tenant sequentially
    for (const tenant of tenants) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tenants/${tenant.id}/sync`, {
          method: 'POST',
          headers: {
            'Cookie': (await import('next/headers')).cookies().toString()
          }
        })

        const data = await response.json()
        results.push({
          tenantId: tenant.id,
          status: response.ok ? 'success' : 'failed',
          data
        })
      } catch (error: any) {
        console.error(`[SYNC] Error syncing tenant ${tenant.id}:`, error)
        results.push({
          tenantId: tenant.id,
          status: 'failed',
          error: error.message
        })
      }
    }

    const duration = Date.now() - startTime
    const totalCostsIngested = results.reduce((sum, r) => {
      return sum + (r.data?.costsIngested || 0)
    }, 0)

    console.log(`[SYNC] Completed in ${duration}ms. Total records: ${totalCostsIngested}`)

    return NextResponse.json({
      success: true,
      totalCostsIngested,
      duration,
      results
    })

  } catch (error: any) {
    console.error('[SYNC] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}

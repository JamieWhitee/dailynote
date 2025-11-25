import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Fetch all summaries for the user, ordered by created_at DESC
    const { data: summaries, error: fetchError } = await supabase
      .from('summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Error fetching summaries:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch summaries' },
        { status: 500 }
      )
    }

    // 3. Return summaries
    return NextResponse.json({
      success: true,
      summaries: summaries || [],
      count: summaries?.length || 0
    })

  } catch (error) {
    console.error('Summaries API error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch summaries'
      },
      { status: 500 }
    )
  }
}

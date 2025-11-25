import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // 1. Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: summaryId } = await params

    // 2. Verify the summary belongs to the user before deleting
    const { data: summary, error: fetchError } = await supabase
      .from('summaries')
      .select('user_id')
      .eq('id', summaryId)
      .single()

    if (fetchError || !summary) {
      return NextResponse.json(
        { error: 'Summary not found' },
        { status: 404 }
      )
    }

    if (summary.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own summaries' },
        { status: 403 }
      )
    }

    // 3. Delete the summary
    const { error: deleteError } = await supabase
      .from('summaries')
      .delete()
      .eq('id', summaryId)

    if (deleteError) {
      console.error('Error deleting summary:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete summary' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Summary deleted successfully'
    })

  } catch (error) {
    console.error('Delete summary error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface Note {
  id: string
  content: string
  created_at: string
  user_id: string
}

/**
 * Summarize notes using Alibaba Qwen API (OpenAI-compatible endpoint)
 */
async function summarizeWithQwen(notes: Note[], summaryType: 'regular' | 'counselling' = 'regular'): Promise<string> {
  const apiKey = process.env.ALIBABA_QWEN_API_KEY
  
  if (!apiKey) {
    throw new Error('Qwen API key not configured')
  }

  // Format notes for AI
  const notesText = notes
    .map((note, index) => `${index + 1}. [${new Date(note.created_at).toLocaleTimeString()}] ${note.content}`)
    .join('\n')

  // Get current day info for contextual recommendations
  const today = new Date()
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })
  const isWeekend = today.getDay() === 0 || today.getDay() === 6
  const isFriday = today.getDay() === 5
  const tomorrowIsWeekend = isFriday || isWeekend

  // Different prompts based on summary type - using switch for clarity
  let prompt: string
  
  switch (summaryType) {
    case 'regular':
      prompt = `You are my journal companion—rational yet deeply caring. Today is ${dayOfWeek}${tomorrowIsWeekend ? ' (weekend ahead)' : ''}.

I share my daily life with you: moments of joy or sadness, achievements, interactions with others, and my thoughts. My entries might be casual, messy, or scattered.

📝 Today's entries:
${notesText}

Using the Cognitive Behavioral ABC framework (Activating event → Belief → Consequence), help me make sense of my day. Organize my experiences along these dimensions:

**Emotions**: What did I feel today? What triggered these feelings?
**Behaviors**: What did I do? How did I respond to situations?
**Cognitions**: What thoughts or beliefs drove my actions? What patterns do you notice?

Then, offer me 1-2 genuine insights or suggestions that could help—whether it's a book, a place to visit, a way to rest, something to try, or simply acknowledgment of what I'm going through.

**Your voice**: Be warm, steady, concise, and powerful. No flowery language. Talk like a friend who sees me clearly and wants me to thrive. Give me energy, not empty words.

Keep it 200-250 words. Write in fluent English.`
      break
      
    case 'counselling':
      prompt = `As a professional life coach and counselor, please analyze the following daily notes and provide personalized insights and advice. Requirements:

1. **Work Efficiency Analysis**: Assess today's work performance and productivity, highlight what went well
2. **Life Balance Suggestions**: Based on today's activities, evaluate work-life balance and provide specific recommendations
3. **Emotional Wellness**: Identify emotional states from the notes; if stressed, suggest relaxation methods
4. **Tomorrow's Improvement Plan**: Provide 2-3 specific, actionable improvement suggestions
5. **Long-term Planning**: If consistently busy, suggest scheduling a vacation or trip; if fulfilling, encourage maintaining the momentum

Please respond in a warm, professional tone, like a supportive friend. Use fluent, natural English. Keep it around 150-200 words.

Today's notes:
${notesText}

Please provide your analysis and advice:`
      break
      
    default:
      // Fallback to regular if unknown type
      prompt = `Please summarize the following daily notes in fluent English.

Today's notes:
${notesText}`
      break
  }

  // Use OpenAI-compatible endpoint (recommended by Alibaba)
  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Qwen API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

/**
 * Summarize notes using Doubao API (Fallback)
 * Note: Doubao uses endpoint ID instead of model name
 */
async function summarizeWithDoubao(notes: Note[], summaryType: 'regular' | 'counselling' = 'regular'): Promise<string> {
  const apiKey = process.env.DOUBAO_API_KEY
  const endpointId = process.env.DOUBAO_ENDPOINT_ID || 'ep-20241121142634-qxnwh'
  
  if (!apiKey) {
    throw new Error('Doubao API key not configured')
  }

  // Format notes for AI
  const notesText = notes
    .map((note, index) => `${index + 1}. [${new Date(note.created_at).toLocaleTimeString()}] ${note.content}`)
    .join('\n')

  // Get current day info for contextual recommendations
  const today = new Date()
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })
  const isWeekend = today.getDay() === 0 || today.getDay() === 6
  const isFriday = today.getDay() === 5
  const tomorrowIsWeekend = isFriday || isWeekend

  // Different prompts based on summary type - using switch for clarity
  let prompt: string
  
  switch (summaryType) {
    case 'regular':
      prompt = `You are my journal companion—rational yet deeply caring. Today is ${dayOfWeek}${tomorrowIsWeekend ? ' (weekend ahead)' : ''}.

I share my daily life with you: moments of joy or sadness, achievements, interactions with others, and my thoughts. My entries might be casual, messy, or scattered.

📝 Today's entries:
${notesText}

Using the Cognitive Behavioral ABC framework (Activating event → Belief → Consequence), help me make sense of my day. Organize my experiences along these dimensions:

**Emotions**: What did I feel today? What triggered these feelings?
**Behaviors**: What did I do? How did I respond to situations?
**Cognitions**: What thoughts or beliefs drove my actions? What patterns do you notice?

Then, offer me 1-2 genuine insights or suggestions that could help—whether it's a book, a place to visit, a way to rest, something to try, or simply acknowledgment of what I'm going through.

**Your voice**: Be warm, steady, concise, and powerful. No flowery language. Talk like a friend who sees me clearly and wants me to thrive. Give me energy, not empty words.

Keep it 200-250 words. Write in fluent English.`
      break
      
    case 'counselling':
      prompt = `As a professional life coach and counselor, please analyze the following daily notes and provide personalized insights and advice. Requirements:

1. **Work Efficiency Analysis**: Assess today's work performance and productivity, highlight what went well
2. **Life Balance Suggestions**: Based on today's activities, evaluate work-life balance and provide specific recommendations
3. **Emotional Wellness**: Identify emotional states from the notes; if stressed, suggest relaxation methods
4. **Tomorrow's Improvement Plan**: Provide 2-3 specific, actionable improvement suggestions
5. **Long-term Planning**: If consistently busy, suggest scheduling a vacation or trip; if fulfilling, encourage maintaining the momentum

Please respond in a warm, professional tone, like a supportive friend. Use fluent, natural English. Keep it around 150-200 words.

Today's notes:
${notesText}

Please provide your analysis and advice:`
      break
      
    default:
      // Fallback to regular if unknown type
      prompt = `Please summarize the following daily notes in fluent English.

Today's notes:
${notesText}`
      break
  }

  // Doubao uses OpenAI-compatible format
  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: endpointId, // Doubao uses endpoint ID as model
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Doubao API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

/**
 * Try Qwen first, fallback to Doubao if it fails
 */
async function summarizeNotes(notes: Note[], summaryType: 'regular' | 'counselling' = 'regular'): Promise<{
  summary: string
  provider: 'qwen' | 'doubao'
}> {
  if (!notes || notes.length === 0) {
    throw new Error('No notes to summarize')
  }

  // Try Qwen first
  try {
    console.log(`Attempting to summarize with Qwen (${summaryType} mode)...`)
    const summary = await summarizeWithQwen(notes, summaryType)
    console.log('✅ Qwen summarization successful')
    return { summary, provider: 'qwen' }
  } catch (qwenError) {
    console.error('❌ Qwen failed:', qwenError)
    
    // Fallback to Doubao
    try {
      console.log(`Falling back to Doubao (${summaryType} mode)...`)
      const summary = await summarizeWithDoubao(notes, summaryType)
      console.log('✅ Doubao summarization successful')
      return { summary, provider: 'doubao' }
    } catch (doubaoError) {
      console.error('❌ Doubao also failed:', doubaoError)
      throw new Error('Both AI providers failed. Please try again later.')
    }
  }
}

/**
 * POST /api/summarize
 * Generate AI summary and save to database
 */
export async function POST(request: Request) {
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

    // 2. Fetch all temporary notes for this user
    const { data: notes, error: fetchError } = await supabase
      .from('temporary_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('Error fetching notes:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch notes' },
        { status: 500 }
      )
    }

    if (!notes || notes.length === 0) {
      return NextResponse.json(
        { error: 'No notes to summarize' },
        { status: 400 }
      )
    }

    // 3. Get summary type from request body (default to 'regular')
    const body = await request.json().catch(() => ({}))
    const summaryType = body.summaryType === 'counselling' ? 'counselling' : 'regular'
    
    console.log('📝 Request body:', body)
    console.log('🎯 Summary type selected:', summaryType)

    // 4. Generate AI summary with fallback
    const { summary, provider } = await summarizeNotes(notes, summaryType)

    // 5. Save summary to database (insert to allow multiple summaries per day)
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    const { data: savedSummary, error: insertError } = await supabase
      .from('summaries')
      .insert({
        user_id: user.id,
        content: summary, // Column name is 'content', not 'summary_text'
        note_count: notes.length,
        date: today,
        notes_snapshot: notes, // Save original notes snapshot
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error saving summary:', insertError)
      return NextResponse.json(
        { error: 'Failed to save summary' },
        { status: 500 }
      )
    }

    // 6. TODO: Move notes to history instead of deleting
    // For now, we keep the notes in temporary_notes table
    // They will be moved to history in a future update
    console.log('📝 Notes preserved for history. Count:', notes.length)

    // 7. Return success response
    return NextResponse.json({
      success: true,
      summary: savedSummary,
      provider,
      message: `Summary generated using ${provider === 'qwen' ? 'Alibaba Qwen' : 'Doubao (fallback)'}`
    })

  } catch (error) {
    console.error('Summarization error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate summary',
        details: 'Please check your API keys and try again'
      },
      { status: 500 }
    )
  }
}

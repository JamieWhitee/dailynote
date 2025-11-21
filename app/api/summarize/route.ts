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

  // Different prompts based on summary type - using switch for clarity
  let prompt: string
  
  switch (summaryType) {
    case 'regular':
      prompt = `请总结以下今日笔记，生成一个简洁的日记摘要。要求：
1. 用中文回答
2. 总结主要活动和事件
3. 保持简洁，3-5句话
4. 突出重点和情绪

今日笔记：
${notesText}

请生成摘要：`
      break
      
    case 'counselling':
      prompt = `作为一位专业的生活顾问和心理咨询师，请分析以下今日笔记，并提供个性化的建议和洞察。要求：

1. **工作效率分析**：评估今天的工作状态和效率，指出做得好的地方
2. **生活平衡建议**：根据今天的活动，判断工作与生活是否平衡，给出具体建议
3. **情绪健康关注**：从笔记中感知情绪状态，如果压力大建议放松方式
4. **明日改进计划**：提供2-3个具体的、可执行的改进建议
5. **长期规划提示**：如果发现持续忙碌，建议安排休假或旅行；如果很充实，鼓励保持

请用温暖、专业的语气，像朋友一样给出建议。用中文回答，保持在200字左右。

今日笔记：
${notesText}

请提供你的分析和建议：`
      break
      
    default:
      // Fallback to regular if unknown type
      prompt = `请总结以下今日笔记。

今日笔记：
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

  // Different prompts based on summary type - using switch for clarity
  let prompt: string
  
  switch (summaryType) {
    case 'regular':
      prompt = `请总结以下今日笔记，生成一个简洁的日记摘要。要求：
1. 用英文回答
2. 总结主要活动和事件
3. 保持简洁，3-5句话
4. 突出重点和情绪

今日笔记：
${notesText}

请生成摘要：`
      break
      
    case 'counselling':
      prompt = `作为一位专业的生活顾问和心理咨询师，请分析以下今日笔记，并提供个性化的建议和洞察。要求：

1. **工作效率分析**：评估今天的工作状态和效率，指出做得好的地方
2. **生活平衡建议**：根据今天的活动，判断工作与生活是否平衡，给出具体建议
3. **情绪健康关注**：从笔记中感知情绪状态，如果压力大建议放松方式
4. **明日改进计划**：提供1-2个具体的、可执行的改进建议
5. **长期规划提示**：鼓励保持

请用温暖、专业的语气，像朋友一样给出建议。用英文回答，保持在150字左右。

今日笔记：
${notesText}

请提供你的分析和建议：`
      break
      
    default:
      // Fallback to regular if unknown type
      prompt = `请总结以下今日笔记。

今日笔记：
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

    // 5. Save summary to database (upsert to handle multiple summaries per day)
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    const { data: savedSummary, error: insertError } = await supabase
      .from('summaries')
      .upsert({
        user_id: user.id,
        content: summary, // Column name is 'content', not 'summary_text'
        note_count: notes.length,
        date: today,
      }, {
        onConflict: 'user_id,date' // Update if exists for this user and date
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

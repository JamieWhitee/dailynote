'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Send, Moon, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Note {
  id: string
  content: string
  created_at: string
  user_id: string
}

export default function DashboardPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [selectedTipType, setSelectedTipType] = useState<'regular' | 'counselling'>('regular')
  const [dayEnded, setDayEnded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadNotes()
    subscribeToNotes()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [notes])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('temporary_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading notes:', error)
        toast.error('Failed to load notes')
        return
      }

      setNotes(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const subscribeToNotes = () => {
    const channel = supabase
      .channel('notes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'temporary_notes',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Only add if not already in the list (prevent duplicates)
            setNotes((prev) => {
              const exists = prev.some(note => note.id === (payload.new as Note).id)
              if (exists) return prev
              return [...prev, payload.new as Note]
            })
          } else if (payload.eventType === 'DELETE') {
            setNotes((prev) => prev.filter((note) => note.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const sendNote = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputText.trim()) {
      toast.error('Please enter a note')
      return
    }

    setSending(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Not authenticated')
        return
      }

      const { data, error } = await supabase
        .from('temporary_notes')
        .insert({
          content: inputText.trim(),
          user_id: user.id,
        })
        .select()
        .single()

      if (error) {
        console.error('Error sending note:', error)
        toast.error('Failed to send note')
        return
      }

      // Immediately add to local state for instant feedback
      if (data) {
        setNotes((prev) => [...prev, data])
      }

      setInputText('')
    } catch (error) {
      console.error('Error:', error)
      toast.error('An error occurred')
    } finally {
      setSending(false)
    }
  }

  const startNewNote = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Delete all temporary notes from database
      const { error } = await supabase
        .from('temporary_notes')
        .delete()
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting notes:', error)
        toast.error('Failed to start new note')
        return
      }

      // Reset all states
      setNotes([])
      setSummary(null)
      setDayEnded(false)
      setInputText('')
      
      toast.success('Ready for new notes!')
    } catch (error) {
      console.error('Error starting new note:', error)
      toast.error('An error occurred')
    }
  }

  const handleEndDay = async (summaryType: 'regular' | 'counselling') => {
    if (notes.length === 0) {
      toast.error('No notes to summarize')
      return
    }

    const confirmMessage = summaryType === 'regular'
      ? `Are you sure you want to end today? This will generate a summary and delete ${notes.length} note(s).`
      : `Generate AI counselling advice based on your ${notes.length} note(s)? Notes will be deleted after.`

    const confirmed = window.confirm(confirmMessage)

    if (!confirmed) return

    const loadingMessage = summaryType === 'regular' 
      ? 'Generating AI summary...'
      : 'Analyzing your day and generating counselling advice...'
    
    const loadingToast = toast.loading(loadingMessage)

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summaryType }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate summary')
      }

      const successMessage = summaryType === 'regular'
        ? `Summary generated! Used ${data.provider === 'qwen' ? 'Alibaba Qwen' : 'Doubao'}`
        : `Counselling generated! Used ${data.provider === 'qwen' ? 'Alibaba Qwen' : 'Doubao'}`

      toast.success(successMessage, {
        id: loadingToast,
      })

      // Show the summary in chat
      setSummary(data.summary.content)
      
      // Mark day as ended - user needs to click "Start New Note" to reset
      setDayEnded(true)

    } catch (error) {
      console.error('End day error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate summary',
        { id: loadingToast }
      )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading notes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)]">
      <Card className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Today - {format(new Date(), 'MMM dd, yyyy')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleEndDay(selectedTipType)}
              variant="outline"
              className="flex items-center gap-2"
              disabled={notes.length === 0 || dayEnded}
            >
              <Moon className="h-4 w-4" />
              End Day
            </Button>
            
            {/* Summary Type Dropdown */}
            <select
              value={selectedTipType}
              onChange={(e) => {
                const value = e.target.value as 'regular' | 'counselling'
                setSelectedTipType(value)
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={notes.length === 0 || dayEnded}
            >
              <option value="regular">Regular Summary</option>
              <option value="counselling">Counselling</option>
            </select>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {notes.length === 0 && !summary ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <p className="text-lg font-medium">No notes yet</p>
                <p className="text-sm mt-2">Start recording your day below!</p>
              </div>
            </div>
          ) : (
            <>
              {notes.map((note) => (
                <div key={note.id} className="flex justify-end">
                  <div className="max-w-[80%]">
                    <div className="bg-blue-500 text-white rounded-lg px-4 py-2 shadow">
                      <p className="whitespace-pre-wrap break-words">{note.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                      {format(new Date(note.created_at), 'HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* AI Summary Display */}
              {summary && (
                <div className="flex justify-center">
                  <div className="max-w-[90%] w-full">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg px-6 py-4 shadow-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="h-5 w-5" />
                        <h3 className="font-bold text-lg">AI Summary</h3>
                      </div>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{summary}</p>
                      <p className="text-xs text-white/80 mt-3 text-right">
                        Generated by AI • {format(new Date(), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area or Start New Note Button */}
        {dayEnded ? (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={startNewNote}
              variant="outline"
              className="w-full py-6 text-lg font-semibold"
            >
              📝 Start New Note
            </Button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              Click to clear today's summary and start recording new notes
            </p>
          </div>
        ) : (
          <form onSubmit={sendNote} className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Record something..."
                className="resize-none"
                rows={2}
                disabled={sending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendNote(e)
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={sending || !inputText.trim()}
                className="h-auto"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </form>
        )}
      </Card>
    </div>
  )
}
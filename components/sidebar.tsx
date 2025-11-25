'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface Note {
  id: string
  content: string
  created_at: string
}

interface Summary {
  id: string
  user_id: string
  content: string
  note_count: number
  date: string
  created_at: string
  notes_snapshot: Note[]
}

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  selectedId: string | null
  onSelect: (summary: Summary | null) => void
  refreshTrigger?: number
}

export default function Sidebar({ isOpen, onToggle, selectedId, onSelect, refreshTrigger }: SidebarProps) {
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [summaryToDelete, setSummaryToDelete] = useState<Summary | null>(null)

  useEffect(() => {
    loadSummaries()
  }, [refreshTrigger])

  const loadSummaries = async () => {
    try {
      const response = await fetch('/api/summaries')
      const data = await response.json()

      if (data.success) {
        setSummaries(data.summaries)
      }
    } catch (error) {
      console.error('Error loading summaries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, summary: Summary) => {
    e.stopPropagation()
    setSummaryToDelete(summary)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!summaryToDelete) return

    const deletedSummary = summaryToDelete
    
    // Close dialog immediately
    setShowDeleteDialog(false)
    setSummaryToDelete(null)

    // Optimistic update: Remove from UI immediately
    setSummaries(prev => prev.filter(s => s.id !== deletedSummary.id))
    
    // If the deleted summary was selected, go back to Today
    if (selectedId === deletedSummary.id) {
      onSelect(null)
    }

    // Show loading toast
    const loadingToast = toast.loading('Deleting...')

    try {
      const response = await fetch(`/api/summaries/${deletedSummary.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete')
      }

      toast.success('History deleted successfully', { id: loadingToast })
    } catch (error) {
      console.error('Error deleting summary:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete', { id: loadingToast })
      
      // Rollback: Restore the deleted summary on error
      setSummaries(prev => [...prev, deletedSummary].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ))
    }
  }

  return (
    <>
      {/* Toggle Button (always visible) */}
      <Button
        onClick={onToggle}
        variant="ghost"
        size="icon"
        className="fixed top-20 left-4 z-50 md:hidden"
      >
        {isOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-16 left-0 h-[calc(100vh-4rem)] 
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
          transition-all duration-300 z-40
          ${isOpen ? 'w-72' : 'w-0 md:w-16'}
          overflow-hidden
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            {isOpen && (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                History
              </h2>
            )}
            <Button
              onClick={onToggle}
              variant="ghost"
              size="icon"
              className="hidden md:flex"
            >
              {isOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </Button>
          </div>

          {/* Content */}
          {isOpen && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {/* Today Button */}
              <Button
                onClick={() => onSelect(null)}
                variant={selectedId === null ? 'default' : 'ghost'}
                className="w-full justify-start"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Today
              </Button>

              {/* Loading State */}
              {loading && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              )}

              {/* Empty State */}
              {!loading && summaries.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  No history yet
                </div>
              )}

              {/* Summaries List */}
              {!loading && summaries.map((summary) => (
                <div
                  key={summary.id}
                  className={`
                    relative w-full text-left p-3 rounded-lg border transition-colors cursor-pointer
                    ${selectedId === summary.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  onClick={() => onSelect(summary)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(summary.created_at), 'HH:mm')}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {summary.note_count} notes
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      {format(new Date(summary.date), 'MMM dd, yyyy')}
                    </div>
                    <button
                      onClick={(e) => handleDeleteClick(e, summary)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete this history"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Collapsed State Icon */}
          {!isOpen && (
            <div className="flex flex-col items-center py-4 space-y-4">
              <Calendar className="h-5 w-5 text-gray-500" />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete History?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this history record from{' '}
              <strong>{summaryToDelete && format(new Date(summaryToDelete.date), 'MMM dd, yyyy')}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

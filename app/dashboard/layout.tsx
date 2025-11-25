'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import Sidebar from '@/components/Sidebar'

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

interface DashboardContextType {
  selectedSummary: Summary | null
  setSelectedSummary: (summary: Summary | null) => void
  refreshSidebar: () => void
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within DashboardLayout')
  }
  return context
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null)
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  const refreshSidebar = () => {
    setSidebarRefreshTrigger(prev => prev + 1)
  }

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        router.push('/login')
        return
      }
      
      setUserEmail(user.email || null)
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Logged out successfully')
      router.push('/login')
      router.refresh()
    } catch (error) {
      toast.error('Error logging out')
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardContext.Provider value={{ selectedSummary, setSelectedSummary, refreshSidebar }}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Top Navigation Bar */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Daily Notes
                </h1>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {userEmail}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Two Column Layout: Sidebar + Main Content */}
        <div className="flex">
          <Sidebar
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            selectedId={selectedSummary?.id || null}
            onSelect={setSelectedSummary}
            refreshTrigger={sidebarRefreshTrigger}
          />
          
          <main className="flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardContext.Provider>
  )
}

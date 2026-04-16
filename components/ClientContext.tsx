'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from 'next-auth/react'

interface ClientContextType {
  selectedClientId: number | null
  setSelectedClientId: (id: number | null) => void
  clients: { id: number; name: string; slug: string }[]
  isSuperAdmin: boolean
  isAgencyStaff: boolean
}

const ClientContext = createContext<ClientContextType>({
  selectedClientId: null,
  setSelectedClientId: () => {},
  clients: [],
  isSuperAdmin: false,
  isAgencyStaff: false,
})

export function ClientProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const user = session?.user
  const isSuperAdmin = user?.role === 'superadmin'
  const isAgencyStaff = user?.role === 'agency_staff'
  const isDemoViewer = user?.role === 'demo_viewer'

  const [selectedClientId, setSelectedClientIdState] = useState<number | null>(null)
  const [clients, setClients] = useState<any[]>([])

  useEffect(() => {
    if (isSuperAdmin || isDemoViewer) {
      fetch('/api/admin/clients')
        .then(r => r.json())
        .then(d => setClients(Array.isArray(d) ? d : []))
        .catch(() => {})
      // superadmin/demo_viewer는 항상 "전체 클라이언트"으로 시작
    } else if (isAgencyStaff) {
      fetch('/api/my/clients')
        .then(r => r.json())
        .then(d => {
          const list = Array.isArray(d) ? d : []
          setClients(list)
          // 배정된 클라이언트이 1개면 자동 선택
          if (list.length === 1) setSelectedClientIdState(list[0].id)
          else {
            const saved = localStorage.getItem('agatha_selected_client')
            if (saved) {
              const savedId = Number(saved)
              if (list.some((c: any) => c.id === savedId)) setSelectedClientIdState(savedId)
            }
          }
        })
        .catch(() => {})
    } else if (user?.client_id) {
      setSelectedClientIdState(user.client_id)
    }
  }, [isSuperAdmin, isAgencyStaff, isDemoViewer, user?.client_id])

  const setSelectedClientId = (id: number | null) => {
    setSelectedClientIdState(id)
    if (id) localStorage.setItem('agatha_selected_client', String(id))
    else localStorage.removeItem('agatha_selected_client')
  }

  return (
    <ClientContext.Provider value={{ selectedClientId, setSelectedClientId, clients, isSuperAdmin, isAgencyStaff }}>
      {children}
    </ClientContext.Provider>
  )
}

export const useClient = () => useContext(ClientContext)

'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from 'next-auth/react'

interface ClientContextType {
  selectedClientId: number | null
  setSelectedClientId: (id: number | null) => void
  clients: { id: number; name: string; slug: string; is_active?: boolean }[]
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
        .then(d => {
          const list = Array.isArray(d) ? d : []
          // 비활성 클라이언트는 사이드바 dropdown 에서 제외 (admin 페이지는 별도 fetch 사용).
          //   비활성 클라이언트를 dropdown 에서 선택해도 백엔드 getClientId() 가 거절하여
          //   전체 보기로 폴백되는 혼란을 방지.
          setClients(list.filter((c: { is_active?: boolean }) => c.is_active !== false))
        })
        .catch(() => {})
      // superadmin/demo_viewer는 항상 "전체 클라이언트"으로 시작
    } else if (isAgencyStaff) {
      fetch('/api/my/clients')
        .then(r => r.json())
        .then(d => {
          const list = (Array.isArray(d) ? d : []).filter((c: { is_active?: boolean }) => c.is_active !== false)
          setClients(list)
          // 배정된 클라이언트이 1개면 자동 선택
          if (list.length === 1) setSelectedClientIdState(list[0].id)
          else {
            const saved = localStorage.getItem('agatha_selected_client')
            if (saved) {
              const savedId = Number(saved)
              if (list.some((c: { id: number }) => c.id === savedId)) setSelectedClientIdState(savedId)
            }
          }
        })
        .catch(() => {})
    } else if (user?.client_id) {
      setSelectedClientIdState(user.client_id)
    }
  }, [isSuperAdmin, isAgencyStaff, isDemoViewer, user?.client_id])

  // 활성 클라이언트 목록이 갱신되면, selectedClientId 가 더 이상 목록에 없을 경우 초기화.
  //   (예: 22 처럼 비활성 처리된 클라이언트가 localStorage 에 남아있는 케이스 정리)
  useEffect(() => {
    if (!selectedClientId || clients.length === 0) return
    if (!clients.some(c => c.id === selectedClientId)) {
      setSelectedClientIdState(null)
      localStorage.removeItem('agatha_selected_client')
    }
  }, [clients, selectedClientId])

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

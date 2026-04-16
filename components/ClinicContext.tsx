'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from 'next-auth/react'

interface ClinicContextType {
  selectedClinicId: number | null
  setSelectedClinicId: (id: number | null) => void
  clinics: { id: number; name: string; slug: string }[]
  isSuperAdmin: boolean
  isAgencyStaff: boolean
}

const ClinicContext = createContext<ClinicContextType>({
  selectedClinicId: null,
  setSelectedClinicId: () => {},
  clinics: [],
  isSuperAdmin: false,
  isAgencyStaff: false,
})

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const user = session?.user
  const isSuperAdmin = user?.role === 'superadmin'
  const isAgencyStaff = user?.role === 'agency_staff'
  const isDemoViewer = user?.role === 'demo_viewer'

  const [selectedClinicId, setSelectedClinicIdState] = useState<number | null>(null)
  const [clinics, setClinics] = useState<any[]>([])

  useEffect(() => {
    if (isSuperAdmin || isDemoViewer) {
      fetch('/api/admin/clinics')
        .then(r => r.json())
        .then(d => setClinics(Array.isArray(d) ? d : []))
        .catch(() => {})
      // superadmin/demo_viewer는 항상 "전체 병원"으로 시작
    } else if (isAgencyStaff) {
      fetch('/api/my/clinics')
        .then(r => r.json())
        .then(d => {
          const list = Array.isArray(d) ? d : []
          setClinics(list)
          // 배정된 병원이 1개면 자동 선택
          if (list.length === 1) setSelectedClinicIdState(list[0].id)
          else {
            const saved = localStorage.getItem('samantha_selected_clinic')
            if (saved) {
              const savedId = Number(saved)
              if (list.some((c: any) => c.id === savedId)) setSelectedClinicIdState(savedId)
            }
          }
        })
        .catch(() => {})
    } else if (user?.clinic_id) {
      setSelectedClinicIdState(user.clinic_id)
    }
  }, [isSuperAdmin, isAgencyStaff, isDemoViewer, user?.clinic_id])

  const setSelectedClinicId = (id: number | null) => {
    setSelectedClinicIdState(id)
    if (id) localStorage.setItem('samantha_selected_clinic', String(id))
    else localStorage.removeItem('samantha_selected_clinic')
  }

  return (
    <ClinicContext.Provider value={{ selectedClinicId, setSelectedClinicId, clinics, isSuperAdmin, isAgencyStaff }}>
      {children}
    </ClinicContext.Provider>
  )
}

export const useClinic = () => useContext(ClinicContext)

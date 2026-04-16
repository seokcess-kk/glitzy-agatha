'use client'

import { useState, Suspense } from 'react'
import { Users } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PageHeader } from '@/components/common'
import { LeadTab } from '@/components/customers/lead-tab'
import { ContactTab } from '@/components/customers/contact-tab'

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-center py-12">로딩 중...</div>}>
      <CustomersContent />
    </Suspense>
  )
}

function CustomersContent() {
  const [activeTab, setActiveTab] = useState('leads')

  return (
    <>
      <PageHeader
        title="고객관리"
        description="리드 전환 추적 및 고객 DB를 관리합니다."
        icon={Users}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="leads">리드</TabsTrigger>
          <TabsTrigger value="contacts">고객DB</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <LeadTab />
        </TabsContent>

        <TabsContent value="contacts">
          <ContactTab />
        </TabsContent>
      </Tabs>
    </>
  )
}

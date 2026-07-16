import { Suspense, type ReactNode } from 'react'

import { MetaPixel } from '@/components/analytics/meta-pixel'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MetaPixel />
      </Suspense>
    </>
  )
}


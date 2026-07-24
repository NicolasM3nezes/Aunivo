'use client'

import { useCallback, useEffect } from 'react'
import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'

import { trackMetaEvent, trackViewContent } from '@/lib/analytics/meta-pixel'

const SENSITIVE_QUERY_PARAMETERS = new Set([
  'invite', 'session_id', 'token', 'code', 'email',
])

function isSafePublicUrl(searchParams: URLSearchParams): boolean {
  return !Array.from(SENSITIVE_QUERY_PARAMETERS).some((key) =>
    searchParams.has(key),
  )
}

export function MetaPixel() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
  const queryString = searchParams.toString()
  // Search-param changes (UTMs, tabs, filters) are not route views.
  const routeKey = pathname

  const trackCurrentPage = useCallback(() => {
    if (!pixelId || !isSafePublicUrl(new URLSearchParams(queryString))) return
    if (typeof window.fbq !== 'function') return

    if (window.__aunivoMetaPixelLastPageView !== routeKey) {
      trackMetaEvent('PageView')
      window.__aunivoMetaPixelLastPageView = routeKey
    }

    if (
      (pathname === '/' || pathname === '/planos') &&
      window.__aunivoMetaPixelLastViewContent !== routeKey
    ) {
      trackViewContent(pathname === '/' ? 'landing' : 'pricing')
      window.__aunivoMetaPixelLastViewContent = routeKey
    }
  }, [pathname, pixelId, queryString, routeKey])

  useEffect(() => {
    trackCurrentPage()
  }, [trackCurrentPage])

  if (!pixelId) return null

  const bootstrap = `
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    if(window.__aunivoMetaPixelId!==${JSON.stringify(pixelId)}){
      fbq('init',${JSON.stringify(pixelId)});
      window.__aunivoMetaPixelId=${JSON.stringify(pixelId)};
    }
  `

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: bootstrap }}
        onReady={trackCurrentPage}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}

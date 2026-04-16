import { NextRequest, NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import fs from 'fs'
import path from 'path'

const logger = createLogger('LPRender')

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lpId = searchParams.get('id')

  if (!lpId) {
    return new NextResponse('랜딩 페이지 ID가 필요합니다.', { status: 400 })
  }

  const supabase = serverSupabase()
  const { data: landingPage } = await supabase
    .from('landing_pages')
    .select('*, client:clients(id, name)')
    .eq('id', lpId)
    .eq('is_active', true)
    .single()

  if (!landingPage) {
    return new NextResponse('랜딩 페이지를 찾을 수 없습니다.', { status: 404 })
  }

  // HTML 파일 읽기 (Supabase Storage 우선, public/landing/ fallback)
  let htmlContent: string | null = null

  // 1. Supabase Storage REST API 직접 호출 — Next.js fetch 캐시 완전 우회
  try {
    const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/landing-pages/${encodeURIComponent(landingPage.file_name)}`
    const res = await fetch(storageUrl, {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      cache: 'no-store',
    })
    if (res.ok) {
      htmlContent = await res.text()
    } else {
      logger.warn('Storage 다운로드 실패', { fileName: landingPage.file_name, status: res.status })
    }
  } catch (err) {
    logger.error('Storage fetch 실패', err, { fileName: landingPage.file_name })
  }

  // 2. fallback: public/landing/ 로컬 파일
  if (!htmlContent) {
    const htmlPath = path.join(process.cwd(), 'public', 'landing', landingPage.file_name)
    if (fs.existsSync(htmlPath)) {
      htmlContent = fs.readFileSync(htmlPath, 'utf-8')
      logger.warn('로컬 fallback 사용', { fileName: landingPage.file_name })
    }
  }

  if (!htmlContent) {
    return new NextResponse('HTML 파일을 찾을 수 없습니다.', { status: 404 })
  }

  // 데이터 주입 (</head> 앞에 스크립트 삽입)
  const clientName = landingPage.client?.name || ''
  const redirectUrl = landingPage.redirect_url || ''
  const dataScript = `
<script>
  window.__LP_DATA__ = {
    clientId: ${landingPage.client_id || 'null'},
    landingPageId: ${landingPage.id},
    clientName: "${clientName.replace(/"/g, '\\"')}",
    redirectUrl: "${redirectUrl.replace(/"/g, '\\"')}"
  };
</script>`

  // 리드 유실 방지: localStorage 큐 스크립트 주입
  const leadQueueScript = `
<script>
(function(){
  var PREFIX = 'lead_q_';
  window.LeadQueue = {
    generateKey: function() {
      return PREFIX + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    },
    generateIdempotencyKey: function() {
      return Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    },
    save: function(payload) {
      try {
        var key = this.generateKey();
        var saved = Object.assign({}, payload);
        if (!saved.idempotency_key) {
          saved.idempotency_key = this.generateIdempotencyKey();
        }
        payload.idempotency_key = saved.idempotency_key;
        localStorage.setItem(key, JSON.stringify({ payload: saved, timestamp: Date.now() }));
        return key;
      } catch(e) { return null; }
    },
    remove: function(key) {
      try { if (key) localStorage.removeItem(key); } catch(e) {}
    },
    getPending: function() {
      var items = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && key.indexOf(PREFIX) === 0) {
            var raw = localStorage.getItem(key);
            if (raw) {
              var parsed = JSON.parse(raw);
              items.push({ key: key, payload: parsed.payload, timestamp: parsed.timestamp });
            }
          }
        }
      } catch(e) {}
      return items;
    },
    retry: function() {
      var pending = this.getPending();
      var self = this;
      var i = 0;
      function next() {
        if (i >= pending.length) return;
        var item = pending[i++];
        // 24시간 이상 된 항목은 삭제
        if (Date.now() - item.timestamp > 86400000) {
          self.remove(item.key);
          next();
          return;
        }
        fetch('/api/webhook/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload)
        }).then(function(res) {
          if (res.ok) self.remove(item.key);
        }).catch(function() {}).then(next);
      }
      next();
    }
  };
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() { window.LeadQueue.retry(); }, 2000);
  });
})();
</script>`

  // GTM 이벤트 트래킹: fetch를 래핑하여 리드 제출 성공 시 dataLayer.push 자동 실행
  // + Meta CAPI 연동: event_id를 UUID로 생성하여 서버/브라우저 중복 제거
  const gtmEventScript = `
<script>
(function(){
  window.dataLayer = window.dataLayer || [];

  // UUID v4 생성 (crypto.randomUUID 폴백)
  function generateEventId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // 제출 성공 오버레이 표시 (일관된 UX, HTML alert 의존 제거)
  function showSuccessOverlay(hasRedirect) {
    var overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;color:#111;border-radius:12px;padding:28px 36px;box-shadow:0 10px 40px rgba(0,0,0,0.25);text-align:center;max-width:320px;';
    var title = document.createElement('div');
    title.style.cssText = 'font-size:18px;font-weight:700;margin-bottom:8px;';
    title.textContent = '제출이 완료되었습니다';
    var desc = document.createElement('div');
    desc.style.cssText = 'font-size:14px;color:#555;';
    desc.textContent = hasRedirect ? '잠시 후 페이지로 이동합니다...' : '문의해 주셔서 감사합니다';
    card.appendChild(title);
    card.appendChild(desc);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  var _origFetch = window.fetch;
  window.fetch = function(url, opts) {
    var eventId = null;
    var isLeadWebhook = typeof url === 'string' && url.indexOf('/api/webhook/lead') !== -1 && opts && opts.method === 'POST';

    if (isLeadWebhook) {
      var bodyObj = null;
      try {
        bodyObj = JSON.parse(opts.body);
        if (!bodyObj.event_id) {
          bodyObj.event_id = generateEventId();
        }
        eventId = bodyObj.event_id;
        // keepalive: 페이지 언로드 후에도 요청 완료 보장
        opts = Object.assign({}, opts, { body: JSON.stringify(bodyObj), keepalive: true });
      } catch(e) {
        eventId = null;
      }

      // 백업: localStorage 큐에 선저장 (keepalive 실패 시 재전송 대상)
      var queueKey = null;
      if (bodyObj && window.LeadQueue) {
        queueKey = window.LeadQueue.save(bodyObj);
      }

      var lpData = window.__LP_DATA__ || {};

      // GTM dataLayer.push (동기) — 이동 전에 트리거 발화
      window.dataLayer.push({
        event: 'form_submit',
        lead_event_id: eventId,
        landing_page_id: lpData.landingPageId || null,
        client_id: lpData.clientId || null,
        client_name: lpData.clientName || ''
      });

      // HTML 내부의 alert() 중복 표시 억제 (우리 오버레이로 대체)
      var _origAlert = window.alert;
      window.alert = function() {};
      setTimeout(function() { window.alert = _origAlert; }, 10000);

      // fetch — 응답 후 HTML의 버튼 업데이트가 먼저 보이도록 오버레이는 지연 표시
      var promise = _origFetch.call(this, url, opts).then(function(res) {
        if (res.ok && queueKey && window.LeadQueue) {
          window.LeadQueue.remove(queueKey);
        }
        if (res.ok) {
          // setTimeout 0 → HTML의 .then 핸들러(버튼 "제출 완료" 변경)가 먼저 실행되도록 다음 태스크로 연기
          setTimeout(function() {
            showSuccessOverlay(!!lpData.redirectUrl);
            if (lpData.redirectUrl) {
              setTimeout(function() {
                try {
                  (window.top || window).location.href = lpData.redirectUrl;
                } catch(e) {
                  window.location.href = lpData.redirectUrl;
                }
              }, 600);
            }
          }, 50);
        }
        return res;
      });

      return promise;
    }

    return _origFetch.call(this, url, opts);
  };
})();
</script>`

  // GTM 태그 주입 (랜딩페이지별 또는 기본 GTM ID)
  const DEFAULT_GTM_ID = 'GTM-5B2QSHGG'
  const gtmId = landingPage.gtm_id || DEFAULT_GTM_ID
  const gtmHeadScript = `
<!-- Google Tag Manager (auto-injected) -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');</script>
<!-- End Google Tag Manager -->`

  const gtmBodyScript = `
<!-- Google Tag Manager (noscript, auto-injected) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`

  // 기존 GTM 태그가 HTML에 있으면 제거 (중복 방지)
  htmlContent = htmlContent.replace(/<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->/g, '')
  htmlContent = htmlContent.replace(/<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->/g, '')
  // auto-injected 주석 버전도 제거 (재렌더링 시)
  htmlContent = htmlContent.replace(/<!-- Google Tag Manager \(auto-injected\) -->[\s\S]*?<!-- End Google Tag Manager -->/g, '')
  htmlContent = htmlContent.replace(/<!-- Google Tag Manager \(noscript, auto-injected\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->/g, '')

  htmlContent = htmlContent.replace('</head>', `${gtmHeadScript}${dataScript}${gtmEventScript}${leadQueueScript}</head>`)
  htmlContent = htmlContent.replace(/<body([^>]*)>/, `<body$1>${gtmBodyScript}`)

  return new NextResponse(htmlContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

export const dynamic = 'force-dynamic'

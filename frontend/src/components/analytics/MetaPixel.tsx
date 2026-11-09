'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { META_PIXEL_ID, isTrackedPage, trackMeta } from '@/lib/meta-pixel';

/**
 * Meta's loader with the pixel id filled in, except the 260 KB of Facebook
 * script is fetched a few seconds late.
 *
 * The pixel used to download its config and loader during startup, competing
 * with the page's own bundle and photos on a slow connection. The queue half of
 * Meta's snippet is kept exactly as published, so init, PageView and every
 * trackMeta call made in the meantime still queue and are sent when the script
 * arrives. The fetch starts three seconds after hydration, or on the first tap,
 * scroll or key press if that comes first — an engaged visitor reports that
 * much sooner, a bounce still reports the page view.
 */
function pixelSnippet(id: string) {
  return `
!function(f,b,e,v,n)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
var started=false;
function load(){if(started)return;started=true;
var t=b.createElement(e);t.async=!0;t.src=v;
var s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
setTimeout(load,3000);
['click','scroll','keydown','touchstart'].forEach(function(ev){
f.addEventListener(ev,load,{once:true,passive:true})})}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');
`;
}

export default function MetaPixel() {
  const pathname = usePathname() || '/';
  const tracked = isTrackedPage(pathname);
  // The snippet itself reports the first page. This guard makes sure a client
  // navigation reports the next one exactly once, without doubling the first.
  const started = useRef(false);
  const lastPath = useRef('');

  useEffect(() => {
    if (!tracked) return;
    if (!started.current) {
      started.current = true;
      lastPath.current = pathname;
      return;
    }
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackMeta('PageView');
  }, [pathname, tracked]);

  if (!tracked) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {pixelSnippet(META_PIXEL_ID)}
      </Script>
      <noscript
        // React cannot diff inside noscript (the browser treats its contents
        // as text while scripts are on), so it is emitted as one raw block.
        dangerouslySetInnerHTML={{
          __html: `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1" alt="" />`,
        }}
      />
    </>
  );
}

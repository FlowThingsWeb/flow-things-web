'use client'

import Script from 'next/script'

/**
 * Google Analytics 4 + Meta Pixel + Microsoft Clarity. Cada uno se activa solo
 * si está configurado su ID; sin ID no renderiza nada.
 *
 * Clarity da mapas de calor y grabaciones de sesión: dónde clickean, hasta
 * dónde scrollean y el recorrido real de cada visitante. Es para dejar de
 * adivinar por qué una página no vende.
 *
 * Nota CSP: googletagmanager.com, connect.facebook.net y clarity.ms están
 * habilitados en script-src (next.config.js). Sin eso el navegador bloquea el
 * script sin avisar.
 *
 * Los Script van con lazyOnload y no con la estrategia por defecto: los dos
 * juntos pesan 398 KB (GTM + Meta) y arrancaban justo cuando la página
 * intentaba pintar, llevándose el hilo principal. En Lighthouse eso se veía
 * como 3,4 s de "render delay" sobre un LCP de 7,1 s. Con lazyOnload se
 * cargan cuando el navegador queda libre: los eventos se siguen registrando,
 * apenas unos instantes más tarde.
 */
export default function Analytics() {
  const ga = process.env.NEXT_PUBLIC_GA_ID
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID
  /**
   * El ID de Clarity va con default y no sólo por variable de entorno.
   *
   * A diferencia de una clave, este identificador viaja en el HTML de cada
   * página: cualquiera que mire el código fuente lo ve. No hay nada que
   * proteger, y ponerlo acá evita que el día que se despliegue en otro lado
   * las grabaciones dejen de andar sin que nadie se entere. La variable
   * NEXT_PUBLIC_CLARITY_ID lo pisa si algún día hay que apuntar a otro
   * proyecto.
   */
  const clarity = process.env.NEXT_PUBLIC_CLARITY_ID || 'ycrn0tm5kv'

  return (
    <>
      {ga && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
            strategy="lazyOnload"
          />
          <Script id="ga4-init" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga}');
            `}
          </Script>
        </>
      )}

      {clarity && (
        <Script id="ms-clarity" strategy="lazyOnload">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarity}");
          `}
        </Script>
      )}

      {pixel && (
        <Script id="meta-pixel" strategy="lazyOnload">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixel}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const forge = require('node-forge')

const WSAA_URL_PROD = 'https://wsaa.afip.gov.ar/ws/services/LoginCms'

// Argentina es UTC-3 sin horario de verano
function toART(d: Date): string {
  const artMs = d.getTime() - 3 * 60 * 60 * 1000
  return new Date(artMs).toISOString().replace('Z', '-03:00')
}

function buildTRA(service: string): string {
  const now = new Date()
  const expire = new Date(now.getTime() + 12 * 60 * 60 * 1000)
  const uniqueId = Math.floor(Date.now() / 1000)

  return `<?xml version="1.0" encoding="UTF-8"?>\n<loginTicketRequest version="1.0">\n  <header>\n    <uniqueId>${uniqueId}</uniqueId>\n    <generationTime>${toART(now)}</generationTime>\n    <expirationTime>${toART(expire)}</expirationTime>\n  </header>\n  <service>${service}</service>\n</loginTicketRequest>`
}

function signCMS(tra: string, certPEM: string, keyPEM: string): string {
  const cert = forge.pki.certificateFromPem(certPEM)
  const privateKey = forge.pki.privateKeyFromPem(keyPEM)

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(tra, 'utf8')
  p7.addCertificate(cert)
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  })

  p7.sign()

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  return Buffer.from(der, 'binary').toString('base64')
}

function extractXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, 'i'))
  return match ? match[1].trim() : ''
}

export interface TokenAuth {
  token: string
  sign: string
}

// Caché en módulo — válido mientras el proceso Node.js esté activo.
// AFIP emite tokens de 12h; renovamos con 5 min de margen.
const tokenCache: Record<string, { token: string; sign: string; expiresAt: number }> = {}

export async function getTokenAuth(
  service: string,
  certPEM: string,
  keyPEM: string
): Promise<TokenAuth> {
  const cacheKey = service
  const now = Date.now()
  const cached = tokenCache[cacheKey]
  if (cached && cached.expiresAt > now) {
    return { token: cached.token, sign: cached.sign }
  }

  const tra = buildTRA(service)
  const cms = signCMS(tra, certPEM, keyPEM)

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)

  let response: Response
  try {
    response = await fetch(WSAA_URL_PROD, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': 'loginCms',
      },
      body: soapBody,
      signal: controller.signal,
    })
  } catch (err: any) {
    const cause = err?.cause
    const code = cause?.code || cause?.message || 'sin código'
    throw new Error(`WSAA conexión fallida: ${err.message} | causa: ${code}`)
  } finally {
    clearTimeout(timer)
  }

  const responseText = await response.text()

  if (!response.ok) {
    const faultMsg = extractXml(responseText, 'faultstring') || extractXml(responseText, 'faultcode')
    throw new Error(`WSAA error: ${faultMsg || responseText.slice(0, 400)}`)
  }

  let ticketXml = extractXml(responseText, 'loginCmsReturn')
  ticketXml = ticketXml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

  const token = extractXml(ticketXml, 'token')
  const sign = extractXml(ticketXml, 'sign')

  if (!token || !sign) {
    throw new Error(`WSAA sin token. Respuesta: ${responseText.slice(0, 500)}`)
  }

  // Guardar en caché con expiración a las 11h 55min (5 min de margen antes de las 12h de AFIP)
  tokenCache[cacheKey] = {
    token,
    sign,
    expiresAt: now + (12 * 60 - 5) * 60 * 1000,
  }

  return { token, sign }
}

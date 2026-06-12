// eslint-disable-next-line @typescript-eslint/no-require-imports
const forge = require('node-forge')

const WSAA_URL_PROD = 'https://wsaa.afip.gov.ar/ws/services/LoginCms'

function buildTRA(service: string): string {
  const now = new Date()
  const expire = new Date(now.getTime() + 12 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace('Z', '-03:00')
  const uniqueId = Math.floor(Date.now() / 1000)

  return `<?xml version="1.0" encoding="UTF-8"?>\n<loginTicketRequest version="1.0">\n  <header>\n    <uniqueId>${uniqueId}</uniqueId>\n    <generationTime>${fmt(now)}</generationTime>\n    <expirationTime>${fmt(expire)}</expirationTime>\n  </header>\n  <service>${service}</service>\n</loginTicketRequest>`
}

function signCMS(tra: string, certPEM: string, keyPEM: string): string {
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(tra, 'utf8')

  const cert = forge.pki.certificateFromPem(certPEM)
  const privateKey = forge.pki.privateKeyFromPem(keyPEM)

  p7.addCertificate(cert)
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [],
  })

  p7.sign({ detached: false })

  const der = forge.asn1.toDer(p7.toAsn1())
  return Buffer.from(der.bytes(), 'binary').toString('base64')
}

function extractXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, 'i'))
  return match ? match[1].trim() : ''
}

export interface TokenAuth {
  token: string
  sign: string
}

export async function getTokenAuth(
  service: string,
  certPEM: string,
  keyPEM: string
): Promise<TokenAuth> {
  const tra = buildTRA(service)
  const cms = signCMS(tra, certPEM, keyPEM)

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`

  const response = await fetch(WSAA_URL_PROD, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=UTF-8',
      'SOAPAction': 'loginCms',
    },
    body: soapBody,
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`WSAA HTTP ${response.status}: ${responseText.slice(0, 300)}`)
  }

  let ticketXml = extractXml(responseText, 'loginCmsReturn')
  ticketXml = ticketXml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

  const token = extractXml(ticketXml, 'token')
  const sign = extractXml(ticketXml, 'sign')

  if (!token || !sign) {
    throw new Error(`WSAA sin token. Respuesta: ${responseText.slice(0, 500)}`)
  }

  return { token, sign }
}

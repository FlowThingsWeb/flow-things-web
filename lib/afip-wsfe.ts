import https from 'https'

const WSFE_HOST = 'servicios1.afip.gov.ar'
const WSFE_PATH = '/wsfev1/service.asmx'
const WSFE_NS = 'http://ar.gov.afip.dif.FEV1/'

// AFIP WSFE usa Diffie-Hellman de 512 bits — incompatible con OpenSSL 3 (Node 18+).
// Usamos https.request con un agent que excluye cipher suites DHE para evitar ERR_SSL_DH_KEY_TOO_SMALL.
const wsfeAgent = new https.Agent({
  ciphers: 'HIGH:!DH:!aNULL',
  keepAlive: false,
})

function extractXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, 'i'))
  return match ? match[1].trim() : ''
}

function callWsfe(method: string, innerXml: string): Promise<string> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${WSFE_NS}"><soapenv:Header/><soapenv:Body>${innerXml}</soapenv:Body></soapenv:Envelope>`
  const body = Buffer.from(envelope, 'utf8')

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: WSFE_HOST,
        path: WSFE_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=UTF-8',
          'SOAPAction': `${WSFE_NS}${method}`,
          'Content-Length': body.length,
        },
        agent: wsfeAgent,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`WSFE HTTP ${res.statusCode}: ${text.slice(0, 300)}`))
          } else {
            resolve(text)
          }
        })
      }
    )
    req.on('error', (err) => reject(new Error(`WSFE conexión: ${err.message}`)))
    req.write(body)
    req.end()
  })
}

function authXml(token: string, sign: string, cuit: number): string {
  return `<ar:Auth><ar:Token>${token}</ar:Token><ar:Sign>${sign}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>`
}

export async function getLastVoucher(
  token: string, sign: string, cuit: number,
  ptoVenta: number, cbteTipo: number
): Promise<number> {
  const xml = `<ar:FECompUltimoAutorizado>${authXml(token, sign, cuit)}<ar:PtoVta>${ptoVenta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo></ar:FECompUltimoAutorizado>`
  const response = await callWsfe('FECompUltimoAutorizado', xml)
  return parseInt(extractXml(response, 'CbteNro') || '0', 10)
}

export interface CAEResult {
  cae: string
  caeFechaVto: string
  nroComprobante: number
}

export async function solicitarCAE(
  token: string, sign: string, cuit: number,
  ptoVenta: number, nroComprobante: number, total: number
): Promise<CAEResult> {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  const xml = `<ar:FECAESolicitar>${authXml(token, sign, cuit)}<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${ptoVenta}</ar:PtoVta><ar:CbteTipo>11</ar:CbteTipo></ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest><ar:Concepto>1</ar:Concepto><ar:DocTipo>99</ar:DocTipo><ar:DocNro>0</ar:DocNro><ar:CbteDesde>${nroComprobante}</ar:CbteDesde><ar:CbteHasta>${nroComprobante}</ar:CbteHasta><ar:CbteFch>${fecha}</ar:CbteFch><ar:ImpTotal>${total.toFixed(2)}</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>${total.toFixed(2)}</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx><ar:ImpIVA>0.00</ar:ImpIVA><ar:ImpTrib>0.00</ar:ImpTrib><ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz></ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq></ar:FECAESolicitar>`

  const response = await callWsfe('FECAESolicitar', xml)

  const cae = extractXml(response, 'CAE')
  const caeFechaVto = extractXml(response, 'CAEFchVto')

  if (!cae) {
    const errMsg = extractXml(response, 'Msg')
    throw new Error(`AFIP no devolvió CAE. ${errMsg || response.slice(0, 400)}`)
  }

  return { cae, caeFechaVto, nroComprobante }
}

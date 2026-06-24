import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth
  const results: Record<string, unknown> = {}

  // 1. ¿Node-forge carga?
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const forge = require('node-forge')
    results.forge = forge ? 'OK' : 'undefined'
  } catch (e: any) {
    results.forge = `ERROR: ${e.message}`
  }

  // 2. ¿Las env vars están cargadas?
  const cert = (process.env.AFIP_CERT || '').replace(/\\n/g, '\n')
  const key = (process.env.AFIP_KEY || '').replace(/\\n/g, '\n')
  results.cert_length = cert.length
  results.key_length = key.length
  results.cert_starts = cert.slice(0, 40)
  results.cuit = process.env.AFIP_CUIT || 'NO DEFINIDO'

  // 3. ¿Puede conectarse a AFIP?
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10000)
    const res = await fetch('https://wsaa.afip.gov.ar/ws/services/LoginCms', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=UTF-8' },
      body: '<test/>',
      signal: controller.signal,
    })
    results.wsaa_http = res.status
    results.wsaa_reachable = true
  } catch (e: any) {
    results.wsaa_reachable = false
    results.wsaa_error = e.message
    results.wsaa_cause = e.cause?.code || e.cause?.message || String(e.cause)
  }

  // 4. ¿Puede conectarse a WSFE?
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10000)
    const res = await fetch('https://servicios1.afip.gov.ar/wsfev1/service.asmx', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=UTF-8' },
      body: '<test/>',
      signal: controller.signal,
    })
    results.wsfe_http = res.status
    results.wsfe_reachable = true
  } catch (e: any) {
    results.wsfe_reachable = false
    results.wsfe_error = e.message
    results.wsfe_cause = e.cause?.code || e.cause?.message || String(e.cause)
  }

  // 5. ¿Node-forge puede parsear el certificado?
  if (cert.length > 100) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const forge = require('node-forge')
      const certObj = forge.pki.certificateFromPem(cert)
      results.cert_parse = 'OK'
      results.cert_subject = certObj.subject.getField('CN')?.value || 'sin CN'
      results.cert_valid_to = certObj.validity.notAfter
    } catch (e: any) {
      results.cert_parse = `ERROR: ${e.message}`
    }
  }

  return NextResponse.json(results, { status: 200 })
}

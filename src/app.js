import './instrument.js'
import express from 'express'
import * as Sentry from '@sentry/node'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json())

// ── CORS — permitir dashboard de control (:3000) ──
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// ── Servir frontend ──
app.use(express.static(path.join(__dirname, '..', 'public')))

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── API: Listar certificados ──
app.get('/api/v1/certificates', (req, res) => {
  const certificates = [
    { id: 'cert-001', name: 'Root CA', algorithm: 'DILITHIUM3', status: 'active', expiresAt: '2027-01-15' },
    { id: 'cert-002', name: 'Intermediate CA', algorithm: 'FALCON512', status: 'active', expiresAt: '2026-12-01' },
    { id: 'cert-003', name: 'Server TLS', algorithm: 'SPHINCS+', status: 'expired', expiresAt: '2025-06-30' },
  ]
  res.json({ data: certificates, total: certificates.length })
})

// ── API: Detalle de certificado ──
app.get('/api/v1/certificates/:id', (req, res) => {
  const certs = {
    'cert-001': { id: 'cert-001', name: 'Root CA', algorithm: 'DILITHIUM3', status: 'active', tenant: 'demo', publicKey: 'MIIBIjANBgkq...' },
    'cert-002': { id: 'cert-002', name: 'Intermediate CA', algorithm: 'FALCON512', status: 'active', tenant: 'demo', publicKey: 'MIICdjCCAh2g...' },
  }
  const cert = certs[req.params.id]
  if (!cert) {
    return res.status(404).json({ error: 'Certificate not found' })
  }
  res.json({ data: cert })
})

// ── API: Generar clave PQC ──
app.post('/api/v1/keys/generate', (req, res) => {
  const { algorithm, keySize } = req.body
  if (!algorithm) {
    return res.status(400).json({ error: 'algorithm is required' })
  }

  const result = {
    keyId: `key-${Date.now()}`,
    algorithm,
    keySize: keySize || 256,
    createdAt: new Date().toISOString(),
    status: 'active',
  }
  res.status(201).json({ data: result })
})

// ── API: Firmar documento ──
app.post('/api/v1/sign', (req, res) => {
  const { payload, keyId } = req.body
  if (!payload || !keyId) {
    return res.status(400).json({ error: 'payload and keyId are required' })
  }

  const signature = {
    signatureId: `sig-${Date.now()}`,
    keyId,
    algorithm: 'DILITHIUM3',
    signature: 'base64-encoded-signature-placeholder',
    timestamp: new Date().toISOString(),
  }
  res.json({ data: signature })
})

// ── API: Verificar firma ──
app.post('/api/v1/verify', (req, res) => {
  const { signatureId, payload } = req.body
  if (!signatureId || !payload) {
    return res.status(400).json({ error: 'signatureId and payload are required' })
  }

  res.json({ data: { valid: true, verifiedAt: new Date().toISOString() } })
})

// ═══════════════════════════════════════════════════════════════════
//  BUGS INTENCIONALES — el agente autonomo debe corregir estos
// ═══════════════════════════════════════════════════════════════════

// ── BUG 1: TypeError — null reference ──
// Simula: dashboard React intenta mostrar detalle de certificado que no existe
app.get('/api/v1/certificates/:id/details', (req, res) => {
  const cert = null  // BUG: deberia buscar el certificado por id
  res.json({
    name: cert.name,               // TypeError: Cannot read properties of null
    algorithm: cert.algorithm,
    expiresAt: cert.expiresAt,
  })
})

// ── BUG 2: ReferenceError — variable no definida ──
// Simula: modulo de cifrado PQC referencia variable que no fue importada
app.post('/api/v1/encrypt', (req, res) => {
  const { data, keyId } = req.body
  const encrypted = cryptoEngine.encrypt(data, keyId)  // BUG: cryptoEngine is not defined
  res.json({ data: { encrypted, keyId } })
})

// ── BUG 3: Error de conexion a DB ──
// Simula: pool de PostgreSQL no puede adquirir conexion
app.get('/api/v1/tenants', (req, res) => {
  const dbPool = null  // BUG: pool no inicializado
  const connection = dbPool.acquire()  // TypeError: Cannot read properties of null
  res.json({ data: connection.query('SELECT * FROM tenants') })
})

// ── BUG 4: Error de autenticacion ──
// Simula: JWT parser falla por token malformado
app.get('/api/v1/auth/validate', (req, res) => {
  const token = req.headers.authorization
  if (!token) return res.status(401).json({ error: 'Authorization header is required' })
  const parts = token.split(' ')
  const decoded = JSON.parse(atob(parts[1]))
  res.json({ data: { valid: true, user: decoded } })
})

// ── BUG 5: Error de constraint / duplicado ──
// Simula: insertar clave con alias duplicado
app.post('/api/v1/keys/import', (req, res) => {
  const keys = new Map()
  keys.set('master-key', { id: 'key-001', algorithm: 'DILITHIUM3' })

  const { alias } = req.body
  if (keys.has(alias)) {
    // BUG: lanza error no manejado en vez de responder 409
    throw new Error(`Duplicate key alias: ${alias}. Constraint violation on (tenant_id, key_alias)`)
  }
  keys.set(alias, { id: `key-${Date.now()}`, algorithm: 'DILITHIUM3' })
  res.status(201).json({ data: { alias, status: 'imported' } })
})

// ═══════════════════════════════════════════════════════════════════

// ── Sentry error handler ──
Sentry.setupExpressErrorHandler(app)

// ── Fallback error handler ──
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)
  res.status(500).json({
    error: err.message,
    path: req.path,
    timestamp: new Date().toISOString(),
  })
})

export default app

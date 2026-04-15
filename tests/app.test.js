import { describe, test, expect } from '@jest/globals'
import request from 'supertest'
import app from '../src/app.js'

describe('Health check', () => {
  test('GET /health responde 200 con status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('API de certificados', () => {
  test('GET /api/v1/certificates retorna lista', async () => {
    const res = await request(app).get('/api/v1/certificates')
    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.total).toBeGreaterThan(0)
  })

  test('GET /api/v1/certificates/:id retorna certificado existente', async () => {
    const res = await request(app).get('/api/v1/certificates/cert-001')
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('cert-001')
    expect(res.body.data.algorithm).toBe('DILITHIUM3')
  })

  test('GET /api/v1/certificates/:id retorna 404 si no existe', async () => {
    const res = await request(app).get('/api/v1/certificates/cert-999')
    expect(res.status).toBe(404)
  })
})

describe('API de claves', () => {
  test('POST /api/v1/keys/generate crea clave con algoritmo', async () => {
    const res = await request(app)
      .post('/api/v1/keys/generate')
      .send({ algorithm: 'DILITHIUM3', keySize: 256 })
    expect(res.status).toBe(201)
    expect(res.body.data.algorithm).toBe('DILITHIUM3')
    expect(res.body.data.keyId).toBeDefined()
  })

  test('POST /api/v1/keys/generate falla sin algoritmo', async () => {
    const res = await request(app)
      .post('/api/v1/keys/generate')
      .send({})
    expect(res.status).toBe(400)
  })
})

describe('API de firma y verificacion', () => {
  test('POST /api/v1/sign firma correctamente', async () => {
    const res = await request(app)
      .post('/api/v1/sign')
      .send({ payload: 'documento-test', keyId: 'key-001' })
    expect(res.status).toBe(200)
    expect(res.body.data.signatureId).toBeDefined()
    expect(res.body.data.algorithm).toBe('DILITHIUM3')
  })

  test('POST /api/v1/sign falla sin payload', async () => {
    const res = await request(app)
      .post('/api/v1/sign')
      .send({ keyId: 'key-001' })
    expect(res.status).toBe(400)
  })

  test('POST /api/v1/verify verifica correctamente', async () => {
    const res = await request(app)
      .post('/api/v1/verify')
      .send({ signatureId: 'sig-001', payload: 'documento-test' })
    expect(res.status).toBe(200)
    expect(res.body.data.valid).toBe(true)
  })
})

// ── Tests que FALLAN por los bugs intencionales ──
// Estos tests documentan el comportamiento esperado.
// Cuando el agente corrija los bugs, estos tests deben pasar.

describe('Endpoints con bugs (deben pasar despues del fix)', () => {
  test('GET /api/v1/certificates/:id/details no debe crashear', async () => {
    const res = await request(app).get('/api/v1/certificates/cert-001/details')
    expect(res.status).not.toBe(500)
  })

  test('POST /api/v1/encrypt no debe lanzar ReferenceError', async () => {
    const res = await request(app)
      .post('/api/v1/encrypt')
      .send({ data: 'test-data', keyId: 'key-001' })
    expect(res.status).not.toBe(500)
  })

  test('GET /api/v1/tenants no debe crashear por pool null', async () => {
    const res = await request(app).get('/api/v1/tenants')
    expect(res.status).not.toBe(500)
  })

  test('GET /api/v1/auth/validate debe manejar token ausente', async () => {
    const res = await request(app).get('/api/v1/auth/validate')
    expect(res.status).not.toBe(500)
  })

  test('POST /api/v1/keys/import con alias duplicado debe retornar 409', async () => {
    const res = await request(app)
      .post('/api/v1/keys/import')
      .send({ alias: 'master-key' })
    expect(res.status).toBe(409)
  })
})

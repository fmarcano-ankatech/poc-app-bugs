import app from './app.js'

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`[APP] AnkaSecure POC corriendo en puerto ${PORT}`)
  console.log(`[APP] Portal: http://localhost:${PORT}`)
  console.log(`[APP] Health: http://localhost:${PORT}/health`)
  console.log(`[APP] API:    http://localhost:${PORT}/api/v1/certificates`)
})

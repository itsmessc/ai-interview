import 'dotenv/config'
import mongoose from 'mongoose'
import { createServer } from 'http'
import { app } from './app.js'
import { initRealtime } from './realtime.js'

const port = Number(process.env.PORT) || 3000
const url = process.env.DATABASE_URL

async function start() {
  try {
    if (!url) {
      throw new Error('DATABASE_URL is not set')
    }

    await mongoose.connect(url)
    console.log('Connected to MongoDB')

    const httpServer = createServer(app)
    initRealtime(httpServer)

    httpServer.listen(port, () => {
      console.log(`API listening on :${port}`)
    })
  } catch (error) {
    console.error('Fatal startup error', error)
    process.exit(1)
  }
}

start()

import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { Interviewer } from './src/models/Interviewer.js'

const url = process.env.DATABASE_URL

async function run() {
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }

  await mongoose.connect(url)

  await Interviewer.deleteMany({})

  const passwordHash = await bcrypt.hash('Password123!', 10)

  await Interviewer.create([
    { name: 'Alice Johnson', email: 'alice@example.com', passwordHash },
  ])

  await mongoose.disconnect()
  console.log('Seeded default interviewer (alice@example.com / Password123!)')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})

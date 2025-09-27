import { Router } from 'express'
import { User } from '../models/User'
export const users = Router()

users.get('/', async (_req, res) => {
  const list = await User.find().lean()
  res.json(list)
})

users.post('/', async (req, res) => {
  const created = await User.create(req.body)
  res.status(201).json(created)
})

users.get('/:id', async (req, res) => {
  const item = await User.findById(req.params.id).lean()
  if (!item) return res.status(404).end()
  res.json(item)
})

users.put('/:id', async (req, res) => {
  const item = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
  if (!item) return res.status(404).end()
  res.json(item)
})

users.delete('/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id)
  res.status(204).end()
})

import { z } from 'zod'

export const StareEveniment = z.enum(['draft', 'published', 'archived'])
export type StareEveniment = z.infer<typeof StareEveniment>

export const EvenimentCalendar = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable(),
  location: z.string().trim().max(200).nullable(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  status: StareEveniment,
  scope: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type EvenimentCalendar = z.infer<typeof EvenimentCalendar>

export const CerereCreareEveniment = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional(),
    location: z.string().trim().max(200).optional(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime().optional(),
  })
  .refine(
    (v) => !v.endsAt || new Date(v.endsAt) >= new Date(v.startsAt),
    { message: 'sfarsitul nu poate fi inaintea inceputului', path: ['endsAt'] },
  )
export type CerereCreareEveniment = z.infer<typeof CerereCreareEveniment>

export const CerereActualizareEveniment = CerereCreareEveniment
export type CerereActualizareEveniment = z.infer<typeof CerereActualizareEveniment>

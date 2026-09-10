import { redacteaza } from '@xc/contracts'

export type Nivel = 'debug' | 'info' | 'warn' | 'error'

export interface ContextLog {
  service: string
  correlationId: string
  userId?: string
}

/**
 * Logger structurat, cu redactare obligatorie. Nu are metoda prin care sa scrii un obiect
 * ne-redactat: tot ce intra pe `date` trece prin `redacteaza()`.
 */
export class Logger {
  constructor(private readonly ctx: ContextLog) {}

  private scrie(nivel: Nivel, mesaj: string, date?: Record<string, unknown>): void {
    const linie = {
      nivel,
      mesaj,
      ts: new Date().toISOString(),
      ...this.ctx,
      ...(date ? { date: redacteaza(date) } : {}),
    }
    const serializat = JSON.stringify(linie)
    if (nivel === 'error') console.error(serializat)
    else if (nivel === 'warn') console.warn(serializat)
    else console.log(serializat)
  }

  debug(mesaj: string, date?: Record<string, unknown>): void {
    this.scrie('debug', mesaj, date)
  }
  info(mesaj: string, date?: Record<string, unknown>): void {
    this.scrie('info', mesaj, date)
  }
  warn(mesaj: string, date?: Record<string, unknown>): void {
    this.scrie('warn', mesaj, date)
  }
  error(mesaj: string, date?: Record<string, unknown>): void {
    this.scrie('error', mesaj, date)
  }

  cu(ctxSuplimentar: Partial<ContextLog>): Logger {
    return new Logger({ ...this.ctx, ...ctxSuplimentar })
  }
}

export const ANTET_CORELARE = 'x-correlation-id'

/** Ia correlationId din antet daca exista, altfel deschide unul nou. Se propaga la orice hop. */
export function correlationId(req: Request): string {
  return req.headers.get(ANTET_CORELARE) ?? crypto.randomUUID()
}

export function logger(service: string, req: Request): Logger {
  return new Logger({ service, correlationId: correlationId(req) })
}

// The only place the UI reads data from. Fixture by default; VITE_DATA_SRC=model prefers
// *.model.json files of the same shape, falling back per file to the fixture.
import type { Company, Group } from './types'

export const GROUP_ID = 'GROUP_0016'
const useModel = import.meta.env.VITE_DATA_SRC === 'model'

const fixtures = import.meta.glob('./fixtures/*.json', { eager: true, import: 'default' }) as Record<string, unknown>

function pick<T>(id: string): { data: T | undefined; source: 'model' | 'fixture' } {
  const model = fixtures[`./fixtures/${id}.model.json`] as T | undefined
  if (useModel && model) return { data: model, source: 'model' }
  return { data: fixtures[`./fixtures/${id}.json`] as T | undefined, source: 'fixture' }
}

export function getGroup(gid: string) { return pick<Group>(gid) }
export function getCompany(id: string) { return pick<Company>(id) }

export type GrupoClasesFarmasi = { id: string; nombre: string; orden: number; claseIds: string[] }

type FilaAgrupacion = {
  id: string
  farmasi_submodulos: { id: string; nombre: string; orden: number } | null
}

export function agruparClasesFarmasi(filas: FilaAgrupacion[], permitidas: ReadonlySet<string>): GrupoClasesFarmasi[] {
  const grupos = new Map<string, GrupoClasesFarmasi>()
  for (const { id, farmasi_submodulos: submodulo } of filas) {
    if (!permitidas.has(id) || !submodulo) continue
    const grupo = grupos.get(submodulo.id) ?? { ...submodulo, claseIds: [] }
    if (!grupo.claseIds.includes(id)) grupo.claseIds.push(id)
    grupos.set(submodulo.id, grupo)
  }
  return [...grupos.values()].sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id))
}

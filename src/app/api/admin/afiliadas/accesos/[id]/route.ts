import { cambiarAccesoAfiliadas } from '@/lib/affiliate-access-server'
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return cambiarAccesoAfiliadas(request, (await context.params).id)
}

import { redirect } from 'next/navigation'

export default async function HelpIdRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/help-requests/${id}`)
}

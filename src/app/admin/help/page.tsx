import { redirect } from 'next/navigation'

export default function HelpRedirectPage() {
  redirect('/admin/help-requests')
}
